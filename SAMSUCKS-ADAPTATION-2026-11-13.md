# SamSUCKS → Nuvio Q70T — uyarlama ve deney araçları

Tarih2026-11-13. Kullanıcının pasted araştırması ve gerçek SamSUCKS kaynakları birlikte incelendi. Referans repo https://github.com/rfaile313/samsucks ; okunan commit `6b00e926e163a3154dd1993a26b47482d61ebf40`. GPL-3.0 ve atıf `docs/SAMSUCKS-ATTRIBUTION.md`, tamlisans `docs/licenses/SamSUCKS-GPL-3.0.txt`; dağıtım notu/lisans `assets/licenses/` altında.

## Son durum: ne etkin, ne pilot?

| Alan                         | Gerçek uygulama                                                                                                                                          | Varsayılan / sınır                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| TV otomatik A/B              | `scripts/q70t-benchmark.mjs` + `scripts/dev/q70t-benchmark-browser.js`; aynı arrow dizisi, interval, JSON frame/DOM/image ve key-to-next-RAF verisi      | Hazır araç; TV'ye bağlanılmadı ve çalıştırılmadı. ÜretimWGT'de yok.                                                                 |
| Gerçek card recycling        | `scripts/dev/q70t-recycled-pilot.js`: row≤12, grid≤24 fiziksel kart; logical index modulo pool; veri değişmedikçe içerik yazılmaz                        | Bağımsız, geçici overlay prototipi. Gerçek Home'un katalog/nav/pagination modeli değiştirilmedi.                                    |
| Sabit focus ring + transform | Aynı row/grid pilotunda; kartlar bounded koordinat penceresinde, ring ayrı                                                                               | Yalnız pilot. Normal Home scroll/focus/özellikler korunur.                                                                          |
| Kare başına yön birleştirme  | `homeFrameNavigation.js`; Home held-arrow repeat son olayını RAF başına tek dispatch;50ms fallback, Enter öncesi flush, keyup flush, Back/cleanup cancel | **Varsayılan KAPALI**, `window.__NUVIO_HOME_FRAME_NAV__ = true` ile açılır. İlkbasış anlık, Enter/Back/player seek kuyruğa alınmaz. |
| WebGL corner background      | Tek2×2canvas,4scissor clear; depth/stencil/antialias yok; contextloss baseline'a dönüş; destroy lose-context                                             | Yalnız DevTools deneyi. CSSgradient/baseline, flat ve WebGL karşılaştırılır. Üretimde yeniWebGLcontext yok.                         |
| Öncelikli images/decode      | Pilot queue4aktif/100queued; focused önce, aynıöncelikyeniler önce; tokenstale/drop;8snetworktimeout;decode250ms fallback;destroy iptal                  | `row`/`grid` decodekapalı; `decode` aynırowdecodeaçık. CPU'dan bağımsız decode garantisi yok.                                       |
| Mevcut image loader          | Generic rescale işinde focusedpriority0/visible1; eski completion yeni image pending bayrağını temizleyemez                                              | Bu küçük lifecycle/priority düzeltmesi normal kodda. Homefocusedfirst/LIFO/stalepolicy zaten vardı, loader komple değiştirilmedi.   |

## Önemli doğruluk sınırları

- Row pilotu Home DOM'daki katalog kartlarının snapshot'ından başlık/poster verisi alır; tüm repository/katalog modeli veya pagination callback'i devralmaz. Grid aynı snapshot'ı kullanır. Enter film oynatmaz; bu bir renderer/focus prototipidir.
- Normal Home arkada canlı kalır. Dolayısıyla pilotun12/24kartı, toplam uygulamanın12/24karta düştüğü veya RAM/FPS kazandığı anlamına GELMEZ. Sonuç JSON'unda Home sayıları ve pilot sayıları ayrı raporlanır. Gerçek productionmigration için logical navigation, stableid, pagination, scroll restore, sourcechanges ve memorybudget bağları ayrıca gerekir.
- Slot güncellemesi indexmodulopool ile yapılır; görünür pencereye bir yeni öğe girince yalnız değişen slotun title/src'si bağlanır. Track/card koordinatları çok büyük logicalindex ile sınırsız GPUkatmanı oluşturmayacak yerelpencerede tutulur.
- Pilot imagequeue bütünNuvio loader'ın yerine geçmez. Legacyrescaler kapalı kalır; worker enabled olmasa dahiOffscreenCanvas'a bakarak büyükgörsel alma düzeltmesi öncekiQ70Tpaketinde vardır.
- Baseline vs flat/WebGL görsel olarak pixel-identical değildir. Deney renkleri sabittir;hero/PlexUltraBlur renk çıkarımı taşınmadı. WebGLkapalı/bağlamkaybında renderer alanı fallback'i bildirir. FPS artışı tekbaşına görselparity kanıtı değildir.
- Key-to-next-RAF, fizikselinput→görünenpiksel gecikmesi DEĞİLDİR. RAFsampler compositor presentation'ını/GPUtoplambelleğini ölçmez.
- SamSUCKS Q60B/Tizen6.5 ölçümleri Q70T/Tizen5.5'e genellenmedi; bu tur hiçbirFPSsonucu alınmadı.

## Güvenli geliştirici bağlantısı

- YeniHTTP/WebSocket/devserver açılmaz. SamSUCKS'in ağa açık evalsunucusu taşınmadı.
- Araç yalnız outboundCDPclient; endpoint host'u127.0.0.1/localhost/[::1] olmalı. TVdebugportu kullanıcı evde sdbforward ile localhost'a yönlendirir.
- `--case`, `--interval`, `--steps`, `--out` dışında JS/CSS/URL evalargümanı yok. Otomatikgirdi yalnız1..100arrowadımı,16..1000ms interval. Enter/Back/Playerseek otomatik gönderilmez.
- Browser devhelper uygulamanın modulegraph'ına import edilmez. WGT yalnızjs/app graph,assets/css/res ve servisleri paketler; `scripts/dev`/CDPtool/benchmarkglobalı sonradan yalnızinspector ile enjekte edilir.
- Her case sonunda CSS/canvas/overlay, imagejobs/timerlar ve queueflag önceki durumuna döner; hata halinde finally cleanup denenir. Script process'i zorla öldürülürse manuelcleanup/reload gerekebilir. Aşağıdaki kurtarma kodunu kullan.
- Rapor title, posterURL, addonURL veya authheader yazmaz; yalnız sayılar, yönler, deneyadı, zamanlar ve numericfocusindexleri bulunur. Debugendpoint detayı rapora konmaz.

## Evde kullanım — ŞİMDİ ÇALIŞTIRILMADI

1. Güncel adayı imzala/kur; debugmodda açıp debugportu localhost9333'e forward et. UygulamayıHome'da bırak, dialog/keyboard/player açık olmasın. Katalog ve poster yüklemesi sakinleşsin.
2. Aynı kart/satır/scroll başlangıcını seç. Önce cache'leri ısıt; soğuk ve sıcak deneyi aynıraporda karıştırma.
3. Aynıinterval/steps ile ayrı case çalıştır. Sonraki case öncesi aynıbaşlangıçkonumuna elle dön. Sıraetkisi için A/B ve B/A tekrarları yap. PilotFPS'yi gerçekHomeFPS ile birebir performansoranı diye raporlama.

```powershell
npm run bench:q70t -- --case baseline --interval 80 --steps "right,right,right,right,left,left,left,left" --out artifacts/q70t-benchmark/base.json
npm run bench:q70t -- --case coalesced --interval 80 --steps "right,right,right,right,left,left,left,left" --out artifacts/q70t-benchmark/queue.json
npm run bench:q70t -- --case flat --interval 80 --steps "right,right,right,right,left,left,left,left" --out artifacts/q70t-benchmark/flat.json
npm run bench:q70t -- --case webgl --interval 80 --steps "right,right,right,right,left,left,left,left" --out artifacts/q70t-benchmark/webgl.json
npm run bench:q70t -- --case row --interval 80 --steps "right,right,right,right,left,left,left,left" --out artifacts/q70t-benchmark/row.json
npm run bench:q70t -- --case decode --interval 80 --steps "right,right,right,right,left,left,left,left" --out artifacts/q70t-benchmark/decode.json
npm run bench:q70t -- --case grid --interval 80 --steps "right,right,down,down,up,left" --out artifacts/q70t-benchmark/grid.json
```

- Yalnızcoalescing etkisini görmek için16/32/64/80/200ms ayrı dene; repeatthrottle'ı aynıanda değiştirme. Araç ardışıksame-direction keydown'ları autoRepeat=true olarak gönderir, yön değişiminde/esassonunda keyup vardır.
- Her case700ms settling sonrası samplerreset ve500ms sondabekleme içerir. Bu kısa örnek tek başına uzun süreprofiling yerine geçmez.
- Varsa `NUVIO_TV_CDP_URL=http://127.0.0.1:<forwardport>` kullan. RastgeleLANadresine bağlanma kabul edilmez.

Manueldeney/kurtarma (yalnızDevTools):

```js
window.__NUVIO_HOME_FRAME_NAV__ = true; // Home held-repeat deneyi
// kapat:
delete window.__NUVIO_HOME_FRAME_NAV__;
// enjekte edilmiş tüm pilot/benchmark state'ini temizle:
if (window.__NUVIO_Q70T_BENCH__) window.__NUVIO_Q70T_BENCH__.destroy();
```

## Zorunlu ev testleri — HEPSİ BEKLİYOR

| ID  | Deney / kabul                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | Baseline/coalesced aynıbaşlangıç+A/B/B/A; p95/max,>33/>50ms, adım/focuskolonu; tekbasışın gecikmediği vehold'un yığılmadığı                          |
| S02 | Pendingrepeat sırasındaEnter/Back; keyup/routecleanup/modal/flagdelete. Backkuyruğa girmemeli; kuyruğunsonradanHome'u hareket ettirmemesi            |
| S03 | Playerseek, volume/media tuşları, SearchIME, posterlongpress hiçcoalescer'a girmemeli                                                                |
| S04 | Row/grid ilk/son öğe,≥100logicalitem, satır değişimi;12/24pool sabitliği ve doğruimg/title/selectedindex; Enter yanlışfilm açmaz (pilotselectkapalı) |
| S05 | PilottaBack veya destroy→gerçekHomefocus/scroll; altyapıda kataloggelmesi, eski cardnode'un kopması; snapshotyanlış ekrana yazılmamalı               |
| S06 | Yavaş/hatalıposter, hızlıslotreuse, decodevar/yok/reject/hang; eski poster yeniiteme yazılmaz;250msdecodefallback/8stimeout sonrası queueilerler     |
| S07 | 10–20dk repeatedpilot open/close; loader/timer/context/DOM birikimi olmamalı; Homebaseline davranışı her dönüşte korunmalı                           |
| S08 | Modernhero baseline/flat/webgl; metinokunurluğu/hero/parity ayrınot. WebGL yok/contextlost ve40tekraropendestroy; context leak/blackscene olmamalı   |
| S09 | Geçerlibağlantıyok/nonHome/dialog açık: araç girdi göndermeden reddetmeli; RPCtimeout sonrasıkeyrelease ve cleanup; localhostdışıendpoint reddi      |
| S10 | YeniWGT'de devtoolglobal/evalserver/scripts/dev yok; sadeceyeni küçükHomequeuehook'u ve imageguard kodu. ÖncekiT01–T21 checklist geçerlidir.         |

## Taşınmayan / sonraki aşama

- GerçekHome logical navigation/pagination/restore prototipe geçirilmedi; normalHomezaten card-inner virtualization kullanır. Bu ayrıbir migration, test edilmemişprototype'ı varsayılan yapmak değil.
- WebGL üretimhero renderer'ı ve çiftcanvascrossfade açılmadı. Önce cihazölçümü ve görselparity gerekir.
- TTF→WOFF2 dönüşümü yapılmadı: yerelRoboto zaten var; fontsubset/coverage ve Türkçe/RTL doğrulaması olmadan yeni fontdosyası üretmedik. MaterialIcons öncekiQ70Tpolitikasında korunur.
- Plexaudio-transcoding, PlexAPI veya minimumTizen6.5config alınmadı; Q70T5.5/Chrome69 hedefi ve EngineFS eskiNodeuyumu korunur.
- Benchmarktool code çalıştırma yöntemi var diye üretimuygulamasına RCEserver eklenmedi.

## Derleme ve son aday kaydı

- Production: `npm run package:tizen -- --outdir artifacts/q70t-candidate` başarılı; imzasızWGT 7788100bayt. SHA256: `a5a80b2d2c02af3beb596b3effbdf4c269f0948560c4e4748706aef91577467e`.
- Devbrowserhelper yalnızesbuild ile Chrome69'a derlendi (10108bayt in-memory); browser'da çalıştırılmadı, CDPbağlantısı yapılmadı.
- ZIPenvanteri: devscripts pakette=False; benchmarkAPI üretimJS'de=False; opt-inHomequeueflag=True; sourceMaps=0; SamSUCKSnotice/lisans asset'leri pakette. EngineFS var/PluginService yok; q70t-tizen55/Chrome69 hedefi korunur.
- Bu kayıt derleme ve statikpaketenvanteridir; test/FPS/canlıcihaz doğrulaması değildir. Test/lint/benchmark/TVbağlantısı/kurulum yok; commit/push yok. SonkuruluTVpaketi değişmedi.
