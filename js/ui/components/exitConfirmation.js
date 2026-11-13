import { NuvioDialog } from "./nuvioDialog.js";
import { focusWithoutScroll } from "../navigation/focusWithoutScroll.js";
import { Platform } from "../../platform/index.js";
import { I18n } from "../../i18n/index.js";

// Every route uses Platform.exitApp(), including native history returns.
// Intercept the existing cancelable event so no Back path can skip confirmation.
export function installExitConfirmation({
  target = document,
  createDialog = (options) => new NuvioDialog(options),
  exit = () => Platform.exitApp(),
  translate = (key, fallback) => I18n.t(key, {}, { fallback }),
  restoreFocus = (node) => {
    if (node?.isConnected) focusWithoutScroll(node);
  }
} = {}) {
  let dialog = null;
  let confirmed = false;
  const onExit = (event) => {
    if (confirmed) return;
    event.preventDefault();
    if (dialog) return;
    const previousFocus = target.activeElement;
    const close = (exitAfter = false) => {
      const current = dialog;
      if (!current) return;
      current.destroy({
        afterExit: () => {
          if (dialog !== current) return;
          dialog = null;
          if (!exitAfter) {
            restoreFocus(previousFocus);
            return;
          }
          confirmed = true;
          try {
            exit();
          } finally {
            confirmed = false;
          }
        }
      });
    };
    dialog = createDialog({
      title: translate("exit_app_title", "Exit Nuvio?"),
      subtitle: translate("exit_app_message", "Are you sure you want to close the app?"),
      widthVw: 43.75,
      buttons: [
        { key: "cancel", label: translate("exit_app_cancel", "Cancel"), onAction: () => close() },
        {
          key: "exit",
          label: translate("exit_app_confirm", "Exit"),
          danger: true,
          onAction: () => close(true)
        }
      ],
      onDismiss: () => close()
    });
    dialog.mount(target.body);
  };
  target.addEventListener("nuvio:beforeExitApp", onExit);
  return () => {
    target.removeEventListener("nuvio:beforeExitApp", onExit);
    dialog?.destroy();
    dialog = null;
  };
}
