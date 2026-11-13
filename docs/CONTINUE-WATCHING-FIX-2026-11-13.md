# Continue Watching düzeltmesi

### Continue Watching erken gösterim düzeltmesi

Kullanıcı CW satırının görünmediğini bildirdi; dizi izlediği için TV bağlantısı, CDP, kurulum ve canlı test yapılmadı.

Kodda iki yeniden üretilebilir bekleme bulundu: hazır recent progress ayrı watched-history sorgusundan sonra yayınlanıyordu; background refresh suppressContinueWatchingLoading=true olduğunda boş bir CW satırı metadata enrichment tamamlanmadan doldurulmuyordu. Ayrıca iptal edilmiş watched sorgusu token kontrolünden önce eski watchedItems değerini yazıyordu. Hazır kartlar bu bağımlılıklardan önce yayınlanıyor, mevcut dolu snapshot arka plan enrichment süresince korunuyor; stale watched sonucu state yazmadan reddediliyor. Yetkili boş progress sonucu tamamlanmış kartları kaldırmaya devam ediyor.

Bu await/suppress akışı upstream'den gelen eski kodda da var (blame: 11ff31185, Eylül2026); son performans commitinde değiştirilmemişti. Hızlandırılan katalogların CW'den önce görünmesi bu beklemeyi daha belirgin yapabilir; bu bir çıkarımdır. Kullanıcının cihazındaki tek kesin neden olduğu canlı inceleme olmadan iddia edilmez. Önceki TV turunda CW ilk açılışta görülmüştü; gecikmiş watched/enrichment ve cancelled-load senaryoları o turda test edilmemişti.

Kanıt: yeni5regresyon testi eskiHEAD'de3fail/2pass; düzeltmede5/5. npm run test:perf180/180, değişen Home modülünde ESLint temiz. Testler npm test:perf içine eklendi. scripts/test-home-continue-watching-publication.mjs. TV'ye aktarılmadı; izlenen yayına dokunulmadı.

Android port: continue-watching/recent progress çizimi watched-history ve metadata completion'dan bağımsız olsun; dolu kartlar refresh'te korunmalı; coroutine cancellation/generation kontrolü state yazımından önce yapılmalı.
