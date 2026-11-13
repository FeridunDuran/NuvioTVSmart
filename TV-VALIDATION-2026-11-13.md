# Q70T TV doğrulaması — 2026-11-13

### 2026-11-13 canlı TV doğrulaması ve main yayını

Kullanıcı test/kurulum/commit/push iznini verdi; önceki test yapma kısıtı kalktı. origin/main, turbo geçmişinin atası doğrulandı; main fast-forward taşındı, force push kullanılmadı.

- Tek kurulum: q70t aday paket nuvio profiliyle imzalandı, Tizen CLI install completed; TV QE55Q70TATXTK / 5.5, debug Chromium69. Kullanıcı verisi silinmedi. İkinci kurulum gerekmedi; bu turdaki kod düzeltmeleri test düzenekleriyle sınırlı.
- Yerel: performance 175/175, lint temiz; upstream entegrasyon 14/14; TMDB detail 14/14. Search submit/IME Back, Home inert DOM, detail/stream parity geçti. VM testlerine yeni Platform/policy/cache/DOM sınırları eklendi; Windows platform path eşleşmesi düzeltildi. TMDB negative cache bağımsız testleri zaten performance grubunda; metadata izolasyon testinde host backoff sınırı stub edildi.
- Genel npm test: ilk 13 ve media sync 3 testi, plugin forwarding/settings sync geçti; mevcut tests/test-plugin-system.mjs bulunmadığı için tüm komut tamamlanmıyor. Testler devre dışı bırakılmadı.
- TV: üretim paketinde local font sınıfı, EngineFS=true / PluginService=false doğrulandı. Gerçek DOM smoke 18/18. Search Matrix sonuçları geldi, input düğümü aynı kaldı; detay ve kaynak ekranları açıldı; geri ile aramaya/Home dönüşü çalıştı. Exit dialog Cancel varsayılan; Enter Cancel sonrası odak Home'a döndü. EngineFS http://127.0.0.1:2710/settings HTTP200.
- Erken Back: detaya tıkladıktan100ms sonra dört Back denemesi4/4 Home'a döndü; CDP ile gözlenen303/322/809/312ms aralığı fiziksel görünür gecikme ölçümü değildir. Tam instant olduğu iddia edilmez.
- Kısa benchmark: baseline p50=16.9ms,p95=33.8ms,max117ms; coalesced p50=16.9ms,p95=43.4ms,max88.3ms. Ardışık örnekler aynı DOM/cache durumunda değil; üstünlük kanıtı yok. Frame coalescing varsayılan KAPALI kaldı. Row/grid/WebGL/decode deneyleri üretime açılmadı.
- Açık: seçilen kaynak player'a geçti, AVPlay prepareAsync görüldü fakat PLAYING/ilk kare doğrulanmadı; HLS15/30/50, UHD ve uzun oynatma geçti sayılmaz. P2P overlay gizliyken opacity0 gözlendi; aktif torrentte kontrollerle aç/kapa bu tur doğrulanmadı.
- Harici YouTube iframe'i queueMicrotask is not defined hatası verdi. Üretim uygulamasında aynı hata kanıtlanmadı; iframe üçüncü taraf kodu. Trailer kalite/oynatma testi açık.
- Ayrıntı ve kalanlar: TV-VALIDATION-2026-11-13.md. Android kaynaklarına dokunulmadı. Port envanteri: PERFORMANCE-IMPLEMENTATION-2026-11-13.md, UPSTREAM-INTEGRATION-2026-11-13.md, Q70T-LLM-REVIEW-2026-11-13.md, SAMSUCKS-ADAPTATION-2026-11-13.md.
