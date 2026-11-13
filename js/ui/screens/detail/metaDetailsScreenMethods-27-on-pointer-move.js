/* eslint-disable no-unused-vars */
import * as internals from "./metaDetailsScreenContext.js";
import { streamRepository } from "../../../data/repository/streamRepository.js";

// Personal build: source prewarm, adapted from the idea in Litefin's PrewarmManager
// (https://github.com/MoazSalem/litefin, MPL-2.0; idea only, no code copied).
// When a movie or series detail page stays open for a moment, the full source search starts in the
// background. The stream screen builds the same request key, so it joins the in-flight
// search (or the 15 min completed cache) instead of starting from zero.
const STREAM_PREWARM_DELAY_MS = 1500;

export function createMetaDetailsScreenMethods27() {
  const { ScreenUtils, buildYoutubeEmbedUrl, Router, resolvePlayableDetailType, resolveMovieStreamIdentity, isSeriesDetailMeta } =
    internals;

  return {
    scheduleStreamPrewarm() {
      if (this.streamPrewarmTimer) {
        clearTimeout(this.streamPrewarmTimer);
      }
      const token = this.detailLoadToken;
      this.streamPrewarmTimer = setTimeout(() => {
        this.streamPrewarmTimer = null;
        if (token !== this.detailLoadToken || Router.getCurrent() !== "detail" || !this.meta) {
          return;
        }
        const itemType = resolvePlayableDetailType(this.params?.itemType || this.meta?.type, this.meta);
        let request = null;
        if (isSeriesDetailMeta(this.meta, this.episodes)) {
          // The episode the primary Play button opens: resume target, next up, or the first.
          const episode = this.findContinueWatchingEpisodeTarget?.();
          if (episode?.id) {
            request = {
              videoId: String(episode.id),
              options: {
                itemId: String(this.params?.itemId || ""),
                season: episode.season,
                episode: episode.episode
              }
            };
          }
        } else if (itemType === "movie") {
          const { itemId, videoId } = resolveMovieStreamIdentity(this.meta, this.params);
          if (videoId) {
            request = { videoId, options: { itemId: String(itemId || ""), season: null, episode: null } };
          }
        }
        if (!request) {
          return;
        }
        const key = `${itemType}:${request.videoId}`;
        if (this.streamPrewarmKey === key) {
          return;
        }
        this.streamPrewarmKey = key;
        // Same request key as the stream screen (type, videoId, season, episode).
        void streamRepository.getStreamsFromAllAddons(itemType, request.videoId, request.options).catch(() => {});
      }, STREAM_PREWARM_DELAY_MS);
    },
    onPointerMove() {
      if (this.isTrailerPlaying && this.trailerPlaybackMode === "manual") {
        this.restartTrailerControlsTimer();
      }
    },
    onPointerFocus() {},
    onPointerActivate(target) {
      if (!target || !this.container?.contains?.(target)) {
        return false;
      }
      const actionTarget = target?.closest?.("[data-action]");
      const action = String(actionTarget?.dataset?.action || "");
      if (action === "toggleTrailer") {
        this.playTrailer({ muted: false, restart: true, initiatedByUser: true });
        return true;
      }
      if (action === "openSharedTrailer") {
        const ytId = String(actionTarget.dataset.trailerYtId || "").trim();
        if (!ytId) {
          return false;
        }
        this.trailerSource = {
          kind: "youtube",
          ytId,
          embedUrl: buildYoutubeEmbedUrl(ytId, { muted: false })
        };
        this.playTrailer({
          muted: false,
          restart: true,
          initiatedByUser: true,
          preserveSource: true
        });
        return true;
      }
      if (action === "openTmdbEntity") {
        return this.openTmdbEntityFromNode(actionTarget);
      }
      if (!action) {
        return false;
      }

      // Pointer activation is a click, not a key-down/key-up hold. Reuse the
      // Android-aligned OK dispatcher so every detail action stays in one path.
      const activation = this.onKeyDown({
        keyCode: 13,
        pointerActivation: true,
        target: actionTarget,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {}
      });
      activation?.catch?.((error) => console.warn("Detail pointer activation failed", error));
      return true;
    },
    async onKeyUp(event) {
      if (Number(event?.keyCode || 0) !== 13) {
        return;
      }
      const current = this.container?.querySelector(".series-episode-card.focusable.focused") || null;
      if (await this.completePendingEpisodeHold(current, event)) {
        event?.preventDefault?.();
        return;
      }
      const season = this.container?.querySelector(".series-season-btn.focusable.focused") || null;
      if (this.completePendingSeasonHold(season, event)) {
        event?.preventDefault?.();
        return;
      }
      const poster = this.container?.querySelector(".detail-morelike-card.focusable.focused") || null;
      if (this.completePendingPosterHold(poster, event)) {
        event?.preventDefault?.();
        return;
      }
      const hero = this.container?.querySelector(".series-detail-actions .focusable.focused") || null;
      if (await this.completePendingHeroHold(hero, event)) {
        event?.preventDefault?.();
      }
    },
    cleanup() {
      if (this.streamPrewarmTimer) {
        clearTimeout(this.streamPrewarmTimer);
        this.streamPrewarmTimer = null;
      }
      this.streamPrewarmKey = null;
      this.synopsisDialog?.destroy();
      this.synopsisDialog = null;
      this.shuffleDialog?.destroy();
      this.shuffleDialog = null;
      this.commentOverlayDialog?.destroy();
      this.commentOverlayDialog = null;
      this.commentOverlay = null;
      this.detailLoadToken = (this.detailLoadToken || 0) + 1;
      this.detailChromeBindPending = null;
      this.cancelTraktCommentsRequest();
      if (this.seasonSwitchTimer) {
        clearTimeout(this.seasonSwitchTimer);
        this.seasonSwitchTimer = null;
      }
      this.cancelPendingEpisodeHold();
      this.cancelPendingSeasonHold();
      this.cancelPendingPosterHold();
      this.cancelPendingHeroHold();
      this.posterOptionsController?.destroy?.({ restoreFocus: false });
      this.posterOptionsController = null;
      this.posterOptionsFocusRestore = null;
      this.destroyDetailHoldDialog();
      this.episodeHoldMenu = null;
      this.seasonHoldMenu = null;
      this.heroPlayMenu = null;
      this.libraryListMenu = null;
      if (this.episodeVirtualSyncRaf) {
        cancelAnimationFrame(this.episodeVirtualSyncRaf);
        this.episodeVirtualSyncRaf = null;
      }
      this.episodeThumbnailPrefetchCache = new Set();
      if (this.episodeThumbObserver) {
        try {
          this.episodeThumbObserver.disconnect();
        } catch (_) {}
        this.episodeThumbObserver = null;
      }
      this.clearEpisodeTitleMarquee(this.episodeMarqueeTitle);
      this.selectedSeasonEpisodeState = null;
      if (this.episodeTrackScrollNode && this.episodeTrackScrollHandler) {
        this.episodeTrackScrollNode.removeEventListener("scroll", this.episodeTrackScrollHandler);
      }
      this.episodeTrackScrollNode = null;
      this.episodeTrackScrollHandler = null;
      this.episodeVirtualWindow = null;
      this.episodeVirtualMetrics = null;
      this.stopTrailerPlayback({
        keepDom: false,
        restartAutoplay: false,
        restoreFocus: false,
        immediateClear: true
      });
      if (this.detailScrollHandler && this.container) {
        const content = this.container.querySelector(".series-detail-content");
        if (content) {
          content.removeEventListener("scroll", this.detailScrollHandler);
        }
        this.detailScrollHandler = null;
      }
      if (this.detailFocusHandler && this.container) {
        this.container.removeEventListener("focusin", this.detailFocusHandler, true);
        this.detailFocusHandler = null;
      }
      if (this.detailClickHandler && this.container) {
        this.container.removeEventListener("click", this.detailClickHandler, true);
        this.detailClickHandler = null;
      }
      if (this.trailerProxyMessageHandler) {
        window.removeEventListener("message", this.trailerProxyMessageHandler);
        this.trailerProxyMessageHandler = null;
      }
      ScreenUtils.hide(this.container);
    }
  };
}
