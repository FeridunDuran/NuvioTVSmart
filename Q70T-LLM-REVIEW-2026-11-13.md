# Q70T araştırma değerlendirmesi ve uygulama — 2026-11-13

Girdi: kullanıcının `a4ca1159-b436-44cc-add0-3db0acf8188a/Pasted text.txt` araştırması. Son kullanıcı düzeltmesi: genel TV uyumluluğu önemli değil, kod yalnız Samsung QE55Q70TATXTK/Q70T Tizen5.5 Chromium69 için. Test ve TV bağlantısı yapılmadı; evde gerekli kontroller `Q70T-EVDE-TEST-2026-11-13.md` içinde.

## Uygulanan yeni değişiklikler

### Poster kaynak kararı

`js/core/tmdb/tmdbImageUrl.js`: küçük kart posteri artık yalnız OffscreenCanvas'ın yokluğuna bağlı değil. Tizen/webOS TV, constrained/legacy render yolu ve efektif piksel oranı<=1 ise TMDB w342; daha yüksek efektif oranda w500 korunur. Worker rescaler legacy cihazda kapalı olduğu halde OffscreenCanvas var diye gereksiz w500 seçme tutarsızlığı giderildi. Yalnız TMDB poster URL normalizasyonu değişir; poster dışı host'lar ve backdrop yolu korunur. Kullanıcı resmi/harici poster URL'sine zorla TMDB ölçüsü uygulanmaz.

TV'de efektif oranı, naturalWidth ve görüntü keskinliği görülmeden2,14kat RAM veya FPS kazancı iddia edilemez. Bu oran yalnız500²/342² piksel oranıdır. Genişlemiş poster/hero ve DPR>1 ayrıca denenecek.

### Tek cihaza özel build/paket

`scripts/compatibilityPolicy.mjs`: varsayılan profil `q70t-tizen55`, browser targetChrome69, Tizen minimum/required5.5, model başlangıç yılı2020. EskiChrome56 frontend hedefi artık kullanılmıyor. Genel2018 TV desteği bu kişisel dalda hedef değil. Esbuild ve core-js aynı compatibilityPolicy değerini kullanır; modern sözdizimleri hâlâ Chrome69'a transpile edilir.

`scripts/build.mjs`: production minify, sourcemap kapalı; `__NUVIO_Q70T_BUILD__` build sabiti ve `dist/build-profile.json` çıktısı. Native JSON'u koruyan önceki polyfill istisnaları korunur. Frontend hedefi servislerin ayrı Node hedeflerini değiştirmez.

`scripts/package-tizen.mjs`: PluginService varsayılan olarak pakette yok; açık `--include-plugin-service` hâlâ mevcut ama buTV için varsayılan kullanılmamalı. EngineFS korunur. Paket source map içermez; `build-profile.json` zorunlu ve build/package target uyuşmazlığı reddedilir. Eski dist'ten yanlış platform WGT üretmek yerine yeniden build gerekir. Store build'in PluginService zorunluluğu ayrı yoldur; bu kişisel development paketidir.

### Yerel metin fontları

`js/app.js`, `css/base.css`: Q70T build'inde GoogleFonts Inter/DM Sans/Open Sans metin stylesheet'i indirilmez. Mevcut paket fontları Roboto-Regular/Bold `Nuvio Local UI` olarak kullanılır; Arial/sans-serif fallback vardır. Tema inline `--app-font-family` atadığından yalnız `q70t-local-fonts` kök sınıfında yerel font değişkeni önemli kuralıyla korunur; diğer tema renkleri/yerleşimi değişmez.

Material Icons stylesheet'i KORUNDU. Pek çok ayar ikonu ligature olduğundan ikon fontunu kaldırmak, bütün ikonları SVG'ye çevirmeden güvenli değildi. Bu tur tüm ikon sistemi yeniden yazılmadı. İnternet yokken ikon fallback/görünürlük ayrıca test edilecek. Türkçe karakterler, bold metrikleri, RTL ve uzun başlıklarda kırpılma TV kontrolü gerektirir.

### HLS buffer karşılaştırma profilleri

Yeni `js/core/player/q70tPlaybackPolicy.js`; kullanım `playerControllerMethods-13-resolve-remote-media-source-type.js` içinde. Tanınan Tizen Chromium<=69 yolunda varsayılan **balanced30sn**; memory15sn ve original50sn runtime A/B seçenekleri var. maxBufferLength ve maxMaxBufferLength birlikte ayarlanır; backBufferLength1,5sn korunur. Bu saniye hedefleri toplam RAM'in hard cap'i değildir; HLS'nin kendi byte/segment/decoder tamponları ayrıca vardır.

Bu, TV'de henüz doğrulanmamış playback davranış değişikliğidir. Zayıf/dalgalı ağda30/15sn daha fazla buffering yapabilir. Evde aynı kaynağı50/30/15 ile ayrı denemeden daha iyi olduğu söylenemez. Runtime seçenekler yalnız oturum içi debug global'idir; kalıcı hesap/ayar verisi yazmaz.

### Kaynak bilgisine göre HLS motor önceliği

`playerScreenMethods-18-start-player-controller-playback.js`: mevcut seçili kaynak adayının yalnız açık videoHeight/height/resolution/quality alanlarından yüksekliği okunur. Film başlığı, URL veya rastgele açıklamadan4K tahmini yapılmaz. Kimlik/istek başlıkları aynı kalır.

`playerControllerMethods-18-play.js`: her yeni play'de currentSourceVideoHeight sıfırdan atanır. BilinenUHD ve AVPlay mevcutsa ilk motor seçimi öncesi gereksiz hls.js preload atlanır.

`playerControllerMethods-12-get-playback-engine-candidates.js`: bilinen>1080p HLS için AVPlay önce; normal/bilinmeyenHD akışlarda mevcut hls.js önceliği korunur. DASH/direct dosya politikası değiştirilmez. Eski fallback adayları korunur. AVPlay buffer ayarları değiştirilmedi; Tizen'de cihaz varsayılanını kullanan erken-return korunur.

Sınır: Bu tam manifest/codec çözümleyicisi değildir. Kaynak çözünürlük alanı yoksa UHD olduğu anlaşılmaz; master manifest için ayrı test gerekir. Fallback'te hls.js hâlâ mümkün; bu değişiklik bütün4K MSE yollarının engellendiği anlamına gelmez. Medya uyumsuzluğunu otomatik olarak düzelttiği iddia edilmez.

## Zaten yerel kodda olan / tekrar yazılmayanlar

- Gerçek card-inner DOM virtualization, dört yakın odak satırı cache'i, shell/dataset navigasyon dayanakları zaten eklendi. Rapordaki CSS parking-only tespiti public/önceki koda ait.
- Değişmeyen satır markup cache'i, locale anahtarı, keyed DOM, read/write ayrımı, progressive yayın ve input sırasında render coalescing mevcut. Bütün Home'u ikinci bir renderer ile yeniden yazmadık; kalan büyük markup/sort işlemlerinin maliyeti CPU trace ile belirlenmeli.
- Tek hero katmanı,300/350ms dwell, aktif medya Set'leri, kontrollü image eviction, UI tick/subtitle batch ve stats polling önceki düzeltmeler olarak korundu.
- EngineFS yalnız ihtiyaçta başlatılma/health fallback'i ve servis runtime ayrımı korunur.6MB servis dosyasını körlemesine küçültmek, torrent peer/concurrency veya Range davranışını değiştirmek yapılmadı. TV profili olmadan motoru değiştirmek daha fazla stall riski taşır. HariciPC streaming çözümü eklenmedi.
- AVPlay buffering olayları ve diagnostic süreleri zaten var. API'ye küçük sabit buffer rakamları eklenmedi; subtitle motorları ve DTS/transcoding politikası değiştirilmedi.
- Gerçek çoklu initial-bundle splitting bu tur yapılmadı: Chromium69 module/IIFE/native bridge ve singleton graph düzeni ayrı doğrulama ister. Önceki lazy player initialization korunur; bunu indirme/parse boyutunu azaltan ayrıchunk diye anlatma.

## Kaynaklar ve kanıt sınırı

- Samsung2020 video özellikleri: https://developer.samsung.com/smarttv/develop/specifications/media-specifications/2020-tv-video-specifications.html
- Samsung WebApp bellek rehberi: https://developer.samsung.com/smarttv/develop/guides/web-app-memory-optimization-guide.html
- Kullanıcı araştırması ve mevcut çalışma ağacı birlikte değerlendirildi; araştırma her öneri için mevcut son kodun kanıtı değildir.
- BrowserV8 ile EngineFS Node runtime ayrı katmanlardır; browser69 hedefi Node4 uyumlu servis bundle'ını modern syntax'a dönüştürmez.
- Cihaz testi/otomatik test/lint çalıştırılmadı. Üretim build/paketleme yalnız derleme kanıtıdır; evdeki zorunlu testlerin yerine geçmez. Önceki upstream9 seçici entegrasyon bu adayın kaynak ağacında bulunur ve onlar da TV'de henüz doğrulanmadı.

## Hazır adayın derleme kaydı

- Komut: `npm run package:tizen -- --outdir artifacts/q70t-candidate` başarılı. Bu bir runtime test sonucu değildir.
- Dosya: `artifacts/q70t-candidate/NuvioTV001_1.4.0.wgt`, imzasız, 7774763 bayt.
- SHA256: `ef398376c73874585df0fcefdff2c796da217b2b070098ba9f52fd422f375245`. Kaynak değişirse yeniden build ve hash gerekir.
- ZIP envanteri/metadata okuması: q70t-tizen55 / chromium69 / localRoboto / sourcemap=false;0.map; EngineFS servis dosyaları var, PluginService yok. Runtime uyumluluk veya bellek kazancı bu envanterden çıkarılamaz.
- Test/lint/CDP/TV bağlantısı/kurulumu yapılmadı. Mevcut TV kurulumu değişmedi. Commit/push yok.
