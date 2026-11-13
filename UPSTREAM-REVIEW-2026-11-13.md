# Upstream incelemesi — 2026-11-13

> Sonraki durum: Kullanıcı aktarım istedi ve9 seçici uyarlama yapıldı. Bu dosya inceleme anının kaydıdır; güncel entegrasyon için UPSTREAM-INTEGRATION-2026-11-13.md ve HANDOFF.md son ekini okuyun. Test/TV işlemi yapılmadı.

Kaynak fork: FeridunDuran/NuvioTVSmart (`turbo`). Yapılan: `git fetch upstream`, `git fetch origin`, commit/diff ve çalışma ağacı karşılaştırması, GitHub PR1340/1341 açıklamalarının okunması. Merge/cherry-pick, ürün kodu değişikliği, test, derleme, TV kurulumu ve push yapılmadı. Önceden mevcut yerel değişiklikler korundu.

Remote upstream URL'si NuvioMedia/NuvioWeb; GitHub sayfaları bugün NuvioMedia/NuvioTVSmart adresine yönleniyor. Bu incelemede remote adresi değiştirilmedi. Son ortak taban14661b42; fetch sonrası upstream/main2cfb6254. HEAD ile upstream ayrışması8 fork commit'i /11 upstream commit'i. Bunun dışında kapsamlı commitlenmemiş yerel iyileştirmeler var; yalnız HEAD karşılaştırması son ürünü temsil etmez.

## Yeni11 commit ve entegrasyon kararı

| Commit            | Değişiklik                                                                                                        | Güncel fork karşılığı / öneri                                                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 586e1a40          | Packaged ZIP ignore düzeni                                                                                        | Performans kazancı yok. Gerekirse yalnız ignore farkı alınır; bütün dosyayı değiştirerek kişisel kuralları ezme.                                                                                                                                                                                        |
| 58c74b5c          | Addon listesinde enabled-state'i her addon için yeniden okumak yerine batch başına bir kez okuma                  | **Alınmaya değer.** Bizde revision cache var fakat her `isAddonEnabled` çağrısı yine clone yapabiliyor. Batch snapshot geçirerek bu iş azaltılabilir.                                                                                                                                                   |
| d52e6574          | Profile-scoped read cache: key revision + profiles revision + aktif profil                                        | **Kısmi uyarlama.** Bizde aynı fonksiyonda revision memo zaten var; ikinci cache'i üstüne ekleme. Profiles-key revision invalidation ve regresyon senaryosu mevcut memo'ya eklenebilir. Bizim URL memo'larını koru.                                                                                     |
| 86cb2f03          | Sidebar root'larını cache'leyip odak sorgusunu yalnız o root'larda yapma                                          | **Kısmi uyarlama.** Bizim activeElement hızlı yolu zaten var. Yalnız fallback'in bütün Home'u taramasını kaldırmak mantıklı; activeElement yolunu geriye alma.                                                                                                                                          |
| 222a5a5a          | Home childNodes Array.from/filter yerine sibling traversal; source===node olduğunda aynı child listesini kullanma | **Öncelikli performans adayı.** Bizim `homeDomUpdate.children` hâlâ Array.from/filter; sibling yolu bağımsız eklenebilir. Bizim sade snapshot, virtualization, adopt ve bounded cache'i koru; dosyayı upstream ile komple değiştirme.                                                                   |
| b0ed37eb          | Tizen screensaver-block native çağrısını10s idle sonrasına bırakma                                                | **Öncelikli cold-start adayı.** Bizde bu geciktirme yok. İlk AppCommon çağrısının Home açılışına denk gelmesini azaltır. Upstream açıklamasındaki243ms ölçümü başka TV'ye ait; bizim Q70T'de ölçülmedi. Ambient tercihini kapatmaz/değiştirmez.                                                         |
| 19a26c3d          | Modern Home row-markup cache anahtarına locale ekleme                                                             | **Alınmalı, doğruluk düzeltmesi.** Bizde anahtar yalnız poster ayarlarını içeriyor. Dil değişince cache'te eski çevrilmiş rozet/etiket kalabilir.                                                                                                                                                       |
| eef28b0f          | Home disk snapshot'ta tüm katalog descriptor'ını koruma, schema v2                                                | **Alınmalı, cold-cache doğruluğu.** Bizde compactRow dar alan kümesiyle type/skip gibi alanları kaybedebiliyor. Bizim7gün TTL, warmup ve bağımsız snapshot read korunmalı. Schema v2 eski cache'i geçersiz kılar; ilk yeni açılışta cache yeniden oluşabilir.                                           |
| f5c67388          | Sürüm1.4.1                                                                                                        | Tek başına performans/bug çözümü değil; seçici portta otomatik sürüm/manifest bump yapma.                                                                                                                                                                                                               |
| c483922e / PR1340 | Kütüphaneden silinen kartın konumuna geçen kartı odaklama; Detail→Back dönüşünde konum koruma                     | **Alınmalı, UX düzeltmesi.** Bizim Library DOM/hold düzeltmeleri bunu karşılamıyor. Controller focus index + render selector düzeltmesi birlikte uyarlanmalı.                                                                                                                                           |
| 2cfb6254 / PR1341 | Tizen9/10 wrt:service `Service` class fallback'i                                                                  | **Uyumluluk adayı, Q70T performans önceliği değil.** Bizim5.5 cihazın ana sorunu değildir. Yeni Service sınıf desteği, mevcut health doğrulaması/başarısız ve accepted launcher yöntem Set'leri korunarak eklenmeli; upstream eski requestServiceStart gövdesiyle bizim fallback düzeltmelerimizi ezme. |

Önerilen sıra:222a5a5a +58c74b5c +b0ed37eb; ardından19a26c3d +eef28b0f +c483922e. d52e6574 ve86cb2f03 yalnız eksik parçalarıyla;2cfb6254 uyumluluk hedefi varsa. Bunlar kaynak/diff temelli adaylardır, bu incelemede ölçülmüş performans kazancı değildir.

## Bizim geliştirmelerden kopyalanmış mı?

**Sonuç: aynı sorunlara ve benzer optimizasyon desenlerine dokunan iki belirgin örtüşme var; kopyalama/kaynak alma niyetini kanıtlayan veri bulunmadı.**

### Profile-scoped memo

- Bizim public remote `origin/turbo` içindeki3d44a28e, readProfileScopedValue raw-text memo'sunu içeriyor.7b633059 bu yolu LocalStore.revision(key) memo'suna çeviriyor.
  -7b633059 commit zamanı12 Kasım23:37:44 Türkiye saati. Upstream d52e6574 commit zamanı13 Kasım01:59:19 Türkiye saati. Bu commit kaydına göre bizim çözüm141dakika35saniye daha erken.
- Aynı fonksiyon, aynı parse/normalize/serialize maliyeti ve aynı revision-cache yaklaşımı kullanılıyor. Ancak uygulama farklı: biz modül düzeyi Map'te key|profileId tutuyoruz; upstream instance Map'te keyRevision/profilesRevision/profileId kontrol ediyor. Upstream ayrıca profiles değişimini invalidation'a katıyor.
- Önemli karşı kanıt/sınır: LocalStore.revision API'si zaten ortak taban14661b42 içinde var; upstream geçmişinde18 Ekim d900632a'ya dayanıyor. Bu API'nin kullanılması bizim icadımız veya tek başına kopyalama izi değildir.
- Commit timestamp, GitHub'a ilk push/görünür olma zamanı değildir. Commit içeriğinin origin/turbo'da bugün bulunması, o dakikada herkese açık olduğunun ispatı sayılmaz.

### Sidebar odak sorgusu

- Bizim7b633059 aynı bütün-Home selector maliyetini activeElement + closest hızlı yoluyla azaltıyor.
- Upstream86cb2f03,13 Kasım02:01:19 Türkiye saati; bizim commit kaydından143dakika35saniye sonra. Aynı hot spot ama farklı çözüm: cache'li sidebar root'larında arama.
- Bu, ortak sorunun benzer zamanda çözülmesiyle de açıklanabilir. Birebir patch veya bizi kaynak gösteren mesaj bulunmadı.

### Diğer commitler

- Sibling walk, screensaver native çağrısını idle'a bırakma, locale cache-key ve snapshot descriptor düzeltmesi bizim bu oturumun son çalışma ağacında uygulanmış değildi. Bu değişiklikler için "bizim kodun aynısı" denemez.
- Upstream PR1341 Tizen9/10 Service sınıfı desteği ekliyor; bizim EngineFS değişikliğimiz kabul yanıtından sonra health doğrulaması/fallback güvenliği. Aynı servis dosyası farklı hata senaryolarıyla değişiyor.
- Upstream PR1340 silinen library kartının focus slot'unu koruyor; bizdeki library değişiklikleri stable render/hold akışıyla ilgili. Aynı dosya adları kopyalama kanıtı değildir.
- Bu oturumdaki son kapsamlı performans değişiklikleri commit/push edilmedi. İncelenen public git geçmişinden upstream'in bunlara eriştiği gösterilemiyor. Önceki Claude commitleri ise origin/turbo'da mevcut.
- İncelenen commit mesajları/diff'lerde FeridunDuran fork'una açık attribution bulunmadı. Attribution bulunmaması tek başına kopyalama ispatı değildir. Fork'un ilk public push zamanı, yazarın fork'u gördüğünü belirten açıklama veya ayırt edici birebir kod/patch eşleşmesi olmadan "çalındı" sonucu çıkarılmamalı.

## Kaynak bağlantıları

- Upstream commit listesi: https://github.com/NuvioMedia/NuvioTVSmart/compare/14661b42...2cfb6254
- Bizim önceki revision memo ve sidebar düzeltmesi: https://github.com/FeridunDuran/NuvioTVSmart/commit/7b633059e7c77a674aecc8d1c9b9405ce08680e6
- Upstream revision memo: https://github.com/NuvioMedia/NuvioTVSmart/commit/d52e65743e2f0afc667cf5389da5a4385b592767
- Sibling traversal: https://github.com/NuvioMedia/NuvioTVSmart/commit/222a5a5a824ca2d2fe65da96add330249454a410
- Screensaver idle: https://github.com/NuvioMedia/NuvioTVSmart/commit/b0ed37eb013a979096f12e90efcf8c8533e5c966
- Library PR: https://github.com/NuvioMedia/NuvioTVSmart/pull/1340
- Service sınıfı PR: https://github.com/NuvioMedia/NuvioTVSmart/pull/1341

Yalnız fetch + salt okunur inceleme ve bu rapor/HANDOFF dokümantasyonu yapıldı. Entegrasyon/merge/kurulum yapılmadı; sonraki değişiklikler mevcut kirli çalışma ağacına seçici olarak uyarlanmalı.
