# Seçici upstream entegrasyonu — 2026-11-13

Kullanıcı talimatı: alınmaya değer upstream işleri aktar, sonraki ajan/Android portu için kaydet; **test yapma, TV bağlı değil**. Çalışma dalı turbo; önceki kirli çalışma ağacı korundu. Merge/cherry-pick commit'i yerine dosya/metot düzeyinde uyarlama yapıldı. Test/lint/build/paketleme, TV bağlantısı/kurulumu, commit ve push yapılmadı. Yalnız kaynak/diff incelemesi ve değişen dosyalarda Prettier biçimlendirmesi uygulandı; bu işlev doğrulaması değildir.

Kaynak upstream son ref:2cfb6254. Kaynak inceleme raporu: `UPSTREAM-REVIEW-2026-11-13.md`. Bu rapordaki "henüz aktarılmadı" ifadeleri önceki inceleme anının tarihçesidir; son aktarım durumu bu belge ve HANDOFF'tadır.

## Alınan9 değişiklik

| Upstream kaynak   | Aktarım ve korunmuş fork davranışı                                                                                                                                                                                                                                                                                  | Android'e sonraki port                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 222a5a5a          | `homeDomUpdate.children`: Array.from/filter yerine firstChild/nextSibling; remember source===node ise tek child listesi. Bizim TokenSnapshot/StyleSnapshot, inert adopt, virtualization ve bounded cache korundu.                                                                                                   | Liste/tree snapshot'ta gereksiz koleksiyon oluşturmayı azalt; native Lazy list'e DOM algoritması taşıma.                                                      |
| 58c74b5c          | `isAddonEnabled(url, enabledStates)` batch snapshot alır. Cached list, manifest refresh ve installed-list filtreleri enabled states'i bir kez okur. URL normalizasyon cache'leri korunur.                                                                                                                           | Aynı liste döngüsünde DataStore/repository snapshot'ını tekrar tekrar okuma/clone etme.                                                                       |
| d52e6574          | Bizim key                                                                                                                                                                                                                                                                                                           | profile memo'suna **profiles key revision** kontrolü eklendi. İkinci upstream cache'i eklenmedi. Dönen clone ve normalizasyon sonrası revision stamp korunur. | Account/profile listesi değişince cache invalidation; immutable state/ownership. |
| 86cb2f03          | Bizim activeElement+closest hızlı yolu korunur; yalnız fallback tüm Home yerine cache'li sidebar root'larını arar, eski root'ları contains ile geçersiz sayar.                                                                                                                                                      | Native focus owner kullan; geniş ağaç taramasını daralt, eski view referansını tutma.                                                                         |
| b0ed37eb          | Ambient tick'te ilk screensaver-block çağrısı10s idle sonrasına alınır. Blocked-route unblock ve timeout/pref davranışı aynı. Kullanıcının Ambient ayarı değiştirilmedi.                                                                                                                                            | İlk frame'de isteğe bağlı pahalı platform çağrısını yapma; Android ekran açık tutma politikası farklı, Samsung API'sini taşıma.                               |
| 19a26c3d          | Modern Home row markup cache anahtarına I18n locale eklendi; dil değişiminde çevrilmiş rozet/etiket yeniden kurulur.                                                                                                                                                                                                | Composition/cache anahtarında locale/configuration invalidation.                                                                                              |
| eef28b0f          | Disk snapshot descriptor'ı type/skip dahil bütün katalog alanlarını korur; schema1→2. Bizim7gün TTL, bootstrap DB warmup ve network'ten bağımsız read korundu.                                                                                                                                                      | Disk DTO'sunda katalog request tipini/pagination bilgisini kaybetme; schema invalidation/migration.                                                           |
| c483922e / PR1340 | LibraryController posterFocusIndex'i profile-key'li persisted filtre state'inde saklar; silinen kartın yerine gelen veya yeni son kartı odaklar. Render selector, focusKey'li poster yerine genel action'ı tercih etmez. Bizim release-hold/stable render düzeltmeleri korundu.                                     | Stable item key + silinme sonrası slot fallback + back-stack scroll/focus koruma.                                                                             |
| 2cfb6254 / PR1341 | Yeni tizenWrtService helper'ı ve EngineFS/PluginService Service-class desteği. EngineFS callback/legacy yolları, triedMethods ve gerçek health probe korundu. Service class varsa legacy WRT sırası tercih edilir. Helper constructor/start senkron throw'unu Promise zincirinde yakalar ve grace timer temizlenir. | Tizen9/10'a özel kodu taşıma; Android servis start kabulü ile gerçekten hazır olma sinyalini ayır.                                                            |

## Kaynak dosyalar

- `js/ui/screens/home/homeDomUpdate.js`
- `js/data/repository/addonRepository.js`
- `js/ui/screens/home/homeScreenMethods-03-is-scroll-animation-active.js`
- `js/ui/ambient/ambientMode.js`
- `js/ui/screens/home/modernHomeLayout.js`
- `js/data/local/homeCatalogSnapshotStore.js`
- `js/ui/screens/library/libraryController.js`
- `js/ui/screens/library/libraryScreenMethods-04-render.js`
- `js/platform/tizen/tizenEngineFsService.js`
- `js/platform/tizen/tizenPluginService.js`
- `js/platform/tizen/tizenWrtService.js` (yeni)

## Taşınan/uyarlanan regresyon kaynakları — ÇALIŞTIRILMADI

- `scripts/test-ambient-blocked-route-tick.mjs`: native screensaver çağrısı10s öncesi yok/sonrası var.
- `js/ui/screens/home/homePosterSettings.test.mjs`: locale değişince row markup invalidation.
- `js/data/local/homeCatalogSnapshotStore.test.mjs`: type/skipStep korunması ve schema v2; bizim8gün expiry senaryosu korundu (upstream13saat testi7gün TTL'ye körlemesine alınmadı).
- `js/data/repository/addonRepository-manifest-refresh.test.mjs`: revision memo, returned value mutation izolasyonu, LocalStore write sonrası invalidation.
- `scripts/test-library-remove-focus.mjs` (yeni): orta/son kart silme, Detail sonrası remount ve değişmeyen kart odağı.
- `scripts/test-tizen-plugin-service-wrt-class.mjs` (yeni): Service.start pending iken gerçek health ile hazır olma.
- Bizim mevcut `scripts/test-tizen-subtitle-service-start.mjs` ve diğer özel test kaynakları korunur; son kaynakların tamamının birlikte geçtiği iddia edilmiyor. Yeni dosyalar package.json varsayılan test komutuna otomatik eklenmedi; sonraki doğrulama turunda açıkça çalıştırılmalı.
- Snapshot test upstream patch'i bizim7gün TTL fixture'ına doğrudan uygulanmadı; patch başarısız oldu ve kısmi dosya yazımı yapmadı. Aynı schema/type/skip değişiklikleri ilgili fixture'a elle uyarlandı. İlk üç bağımsız upstream patch daha önce başarıyla uygulanmıştı; tekrar uygulanmadı.

## Özellikle alınmayanlar

- f5c67388 release1.4.1: fork sürümü kendiliğinden yükseltilmedi. Mevcut1.4.0 paketleme kimliği korunur.
  -586e1a40 ignore düzeni: runtime performansıyla ilgisi olmadığı için kapsam dışı bırakıldı.
- Bizim büyük değiştirilmiş dosyalar upstream kopyalarıyla değiştirilmedi. Head1.4.1'e toplu merge edilmedi; yeni kaynaklar seçici uyarlama olarak çalışma ağacında.

## Devam eden ajan için

1. Kullanıcının bu tur **test çalıştırmama ve TV'ye bağlanmama** talimatını koru. Kullanıcı sonradan doğrulama isterse önce bu uyarlanmış kaynakları ve mevcut yerel değişiklikleri birlikte değerlendir.
2. Snapshot schema2 eski schema1 cache'ini reddeder; ilk sonraki açılışta bir kerelik cache yenilemesi normaldir.7gün TTL/warmup/parallel read kaybolmamalı.
3. Tizen5.5 Q70T Service-class iyileştirmesinin asıl hedefi değildir.5.5 callback/fallback/health akışı ile9/10 Service sınıfı yolu ayrı doğrulanmalıdır.
4. Library focus restoration'da aktif profile key değişimi ve son kart silinmesi özellikle incelenmeli. Sidebar cache'inde eski DOM root'u tekrar kullanılmamalı.
5. D52'nin profilesRevision değişimi için profile-list write senaryosu ayrıca değerlendirilmelidir; alınan upstream test yalnız temel key write/mutation yollarını kapsar. Bu tur yeni test yazılıp çalıştırılmadı.
6. Son kurulu TV paketi bu değişiklikleri **içermiyor**: son kurulum cold-start paketiydi (pid25860/debug0). Bu tur yeni WGT üretilmedi ve cihaz durumu sorgulanmadı.
7. Android deposuna dokunulmadı. HANDOFF Android port envanterindeki16 başlığa bu dokuz entegrasyon eklenmiştir; native karşılıklar henüz incelenmiş/uygulanmış sayılmamalı.

Kaynak PR'lar: https://github.com/NuvioMedia/NuvioTVSmart/pull/1340 ve https://github.com/NuvioMedia/NuvioTVSmart/pull/1341. Diğer kaynak commit kimlikleri tablodadır. Kaynak alma açıkça upstream'e atfedilmiştir; bu tur commit/push yoktur.
