# NuvioTVSmart — Samsung Q70T performans araştırması

2026-11-13. Kapsam: mevcut kaynak kodu, önceki gerçek TV CPU/render profilleri, kurulu TV üzerinde yeni DOM/bellek/özellik sayımları ve salt okunur mikro ölçümler. Bu araştırmada üretim kodu veya kurulu uygulama değiştirilmedi; yeni paket kurulmadı. Son geçerli uygulama kontrolü: önceki düzeltmelerde 167 test ve lint başarılı.

## Kanıt ve ölçüm sınırları

- TV: Samsung Q70T, Tizen 5.5; canlı UA Chromium 69.0.3497.106. Samsung'un [motor tablosu](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html) da 2020/Tizen 5.5 için M69 gösteriyor.
- Önceki sıcak Home gezinti profili: 502 kare, p90 64 ms, p99 142 ms, max 169 ms. İlk Home örneğinde max 2303 ms vardı; tekrar etmemesi kök nedenin giderildiği anlamına gelmiyor.
- Aynı sıcak Home kaydında GPU görevleri yaklaşık 3074 ms, UpdateLayerTree 1369 ms; native focus 454 ms, releaseHomeLazyImage 121 ms, collapseFocusedPoster 119 ms, refreshPendingHomeTrailerCleanup 117 ms, pauseActiveTrailerLayersForNavigation 111 ms. Bunlar kayıt boyunca biriken sürelerdir; kare başına süre veya birbirine eklenebilir bağımsız bütçeler değildir.
- Önceki Search gezinti profili: 530 kare, p90 18 ms, max 271 ms. İlk sonuç 408 ms, dört satır 834 ms, beş satır 2885 ms; 320 ms yazma gecikmesi dahil.
- Yeni DOM sayımı detay ekranı açıkken alındı: belge genelinde 6543 element; gizli Home içinde 6338 element, 527 kart, 60 park edilmiş satır. Satır gizleme çalışsa da kart nesneleri tutuluyor.
- CDP Memory sayımı: 4 belge, 31185 node, 111 JS listener. JS heap yaklaşık 26.4 MiB kullanılan / 34.2 MiB ayrılmış. Node sayısı metinleri, detached karşılaştırma düğümlerini ve diğer belgeleri de kapsar; tek başına sızıntı kanıtı değildir.
- 35 benzersiz yüklenmiş görselin doğal boyutlarından hesaplanan RGBA piksel toplamı yaklaşık 36 MiB. Bu, gerçek ayrılmış resim/GPU belleği ölçümü değildir; paylaşım, decode yaşam döngüsü ve native cache bilinmiyor.
- Detay ekranında 8 compositor katmanı / 1 içerik katmanı görüldü. Bu sayım Home çizilirken alınmadığı için Home katman sayısının kanıtı olarak kullanılmamalı.

## 1. İlk uygulanacak: fragman ve genişlemiş kart kayıtları

**Güven: yüksek. Risk: düşük–orta.**

Kaynaklar:

- `js/ui/screens/home/homeScreenMethods-12-sync-collection-hero-media.js`: pauseActiveTrailerLayersForNavigation, refreshPendingHomeTrailerCleanup.
- `js/ui/screens/home/homeScreenMethods-13-mount-trailer-layer.js`: mountTrailerLayer, collapseFocusedPoster.
- `js/ui/screens/home/homeScreenMethods-18-focus-node.js`: focusNode.

Home her odak hareketinde bütün fragman placeholder'larını seçiyor; ardından her placeholder içinde iframe/video arıyor. Aynı hareket içinde genişlemiş posterler için de tam tarama yapılabiliyor. Hiç oynayan fragman yokken bile iş sürüyor.

TV mikro ölçümü, gizli Home üzerinde, 7 tur × 20 tekrar:

| İş                                                   | Veri                     |                     Medyan / çağrı |
| ---------------------------------------------------- | ------------------------ | ---------------------------------: |
| Tüm fragman alanlarını seçip her birinde medya arama | 516 placeholder, 0 medya |                           2.275 ms |
| Önceden kaydedilmiş medya alanlarını dolaşma         | 0 kayıt                  | ölçüm çözünürlüğünde yaklaşık 0 ms |
| Genişlemiş/fragman aktif poster seçicisi             | aynı Home                |                           1.510 ms |

Kayıtlı alan deneyi bir prototip maliyetidir; üretim uygulamasına entegre edilmiş performans kazancı değildir. Boş kayıt, fragman varken yapılacak işi temsil etmez.

Uygulama: medya oluşturulurken Set'e ekle; temizlenince çıkar. Genişleyen kartlar için tek referans veya küçük Set tut. Gerçekten medya/expanded kart yokken erken çık. Tam DOM taramasını yeniden render sonrası tutarlılık kontrolüne bırak.

Kritik testler: kart/hero fragmanı; açılmakta olan iframe'in odaktan çıkınca düşmesi; aynı fragmanın yeniden kullanımı; gecikmiş cleanup'ın yeni oynatıcıyı silmemesi; tekrarlı tuşların cleanup süresini uzatmaması; route kapanınca Set'in güçlü referans bırakmaması. Mevcut trailer lifecycle testleri korunmalı.

## 2. En büyük yapısal aday: Home kartlarını gerçek DOM penceresine almak

**Potansiyel etki: yüksek. Güven: yüksek, kazanç miktarı henüz ölçülmedi. Risk: orta–yüksek.**

Mevcut `homeRowWindow.js`, uzak satırların yüksekliğini koruyup çocuklarını CSS ile gizliyor. TV'de `content-visibility` desteği false; fallback `display:none` kullanıyor. Bu layout/paint yükünü sınırlıyor, ancak 527 kartı ve yaklaşık 6300 Home elementini tutuyor.

Öneri: görünür satırlar ve küçük komşu pencere dışında kart DOM'unu oluşturma; satır verisini ve yükseklik placeholder'ını tut. Yatay listelerde de görünür kartlar ve küçük tamponla sınırlı havuz kullan. Detaydan dönüşte odak/scroll kimliği veriden kurulmalı; bütün Home'un sıfırdan oluşturulması tercih edilmemeli.

[Samsung bellek rehberi](https://developer.samsung.com/smarttv/develop/guides/web-app-memory-optimization-guide.html), uzun TV listelerinde görünür pencere ve DOM elemanı geri dönüşümünü öneriyor. Burada mevcut park etmenin üzerine eklenmesi gereken parça, görünmeyen kart nesnelerinin de sınırlandırılmasıdır.

İlk deney hedefi: aynı katalog/veri korunurken Home kart sayısını görünür pencereyle sınırlamak. Başarı ölçütleri: daha az canlı node, daha düşük style/layout süresi, boş poster veya odak kaybı olmaması. Kart sayısını belirli bir sayıya indirmek tek başına başarı sayılmaz.

Riskler: hızlı dikey geçiş; son satıra atlama; aynı sütunu hatırlama; Continue Watching artımlı yükleme; koleksiyon klasörleri; geri dönüş; kaynak değişirken kart kaldırılması; ertelenmiş resim/fragman callback'leri.

## 3. Görsel yükleme ve tahliyeyi iki aşamaya ayırmak

**Potansiyel etki: orta. Güven: orta. Risk: orta.**

`homeScreenMethods-24-schedule-home-lazy-image-hydration.js` içindeki eviction döngüsü bir satırın rect'ini okuyup resim src'lerini kaldırıyor, sonra sonraki satırın rect'ini okuyor. Bazı patikalarda ölçüm ve yazım yeniden iç içe giriyor. Bu dizilim layout/style zorlamasına aday; her src değişiminin mutlaka reflow yaptığı varsayılmamalı.

Öneri: önce bütün ilgili satır ölçümleri; sonra tahliye listesi; ardından src kaldırma/URL bırakma. Navigasyonun kritik anında yalnız odaklanan görseli yükle; diğer görünür/komşu işleri küçük parçalara böl. Aynı yatay satırda gezerken bütün dikey eviction geometrisini tekrar ölçme; viewport/DOM değişimiyle invalidation kullan.

Eski TV'nin küçük bellek penceresi korunmalı. Eviction'ı bütünüyle kapatmak veya resim cache'ini sınırsız büyütmek araştırma sonucuyla desteklenmiyor. Dönerken tekrar decode ve pik bellek birlikte ölçülmeli.

[Layout rehberi](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing), DOM boyutu ve ardışık stil yazımı/geometri okumalarının etkileşim gecikmesiyle ilişkisini açıklıyor.

## 4. Search'te mevcut satır DOM'unu korumak

**Potansiyel etki: orta; özellikle çok eklentili arama. Güven: yüksek. Risk: orta.**

Satır verisi ve stateKey artık kararlı; tamamlanma anındaki gereksiz çizimler azaltıldı. Buna rağmen `renderResultsOnly()` başlıktan sonraki bütün kardeşleri silip sonuç HTML'ini tekrar ekliyor. Tam `render()` ise sidebar ve input dahil ekranı yeniden kuruyor. Kademeli yeni satırlar gelince mevcut posterler de yeniden oluşturulabiliyor.

Öneri: stateKey → mevcut section Map'i. Değişmeyen satıra dokunma; yeni satırı katalog sırasındaki yerine ekle; değişen badge'i yerinde güncelle. Input, IME seçimi, aktif kart ve her track'in scrollLeft'i aynı DOM düğümleri üzerinde kalmalı. Yeni gelen satır seçili satırın üstüne eklenince dikey konum korunmalı.

Testler: geç gelen ilk katalog, yazarken sonuç gelmesi, Tizen Done/Cancel, hızlı sorgu değişimi, eklenti timeout'u, watched işareti, sidebar odağı, kısa/uzun OK ve detaydan dönüş. Başarı: aynı DOM düğümlerinin korunması ve daha az render/layout; ağ yanıtını hızlandırdığı iddia edilmemeli.

## 5. Home karşılaştırma snapshot'larının maliyeti

**Potansiyel etki: orta; açılış/arka plan yenilemesi. Güven: orta. Risk: yüksek.**

`homeDomUpdate.js`, canlı düğüm başına inert document içinde kopya node saklıyor; satır/kart sınırlarında markup da tutuluyor. Bu, canlı odak ve fragman durumunu korumak için yapılmış. 31185 toplam node'un bir kısmını açıklayabilir; oranı heap-retainer analizi yapılmadan hesaplanamaz.

Aday: bütün alt düğümler için DOM snapshot'ı yerine satır/kart seviyesinde sade veri veya attribute snapshot'ları. Önce ilk render, veri yenilemesi ve hero güncellemesinde snapshot süresi ayrı ölçülmeli. Mevcut state-preserving reconciliation korunmadan snapshot cache'i silinmemeli.

## 6. GPU katmanları ve CSS: Home açıkken kontrollü A/B

**Potansiyel etki: yüksek olabilir; henüz yönü doğrulanmadı. Risk: orta.**

Önceki Home kaydında GPU ve katman ağacı işi belirgin. Kalıcı `will-change`, `translateZ(0)`, geniş hero yüzeyleri, gölge ve opacity birleşimleri aday. Ancak bugün detay ekranında alınan 8 katmanlık sayım, Home'da katman şişmesi olduğunu kanıtlamıyor.

Deney: Home açıkken layer tree / compositing reasons kaydı; bir defada tek kapsamlı CSS değişikliği; aynı kartlar ve tuş dizisiyle A/B/A tekrarları. `translateZ(0)` veya `will-change` topluca kaldırılmamalı; bazı kaydırma yüzeylerinde tersine yavaşlama yaratabilir. Katman alanı ve GPU süresi birlikte izlenmeli.

## 7. Açılış paketi ve ilk büyük takılma

**Potansiyel etki: açılışta orta–yüksek; gezintide sınırlı. Güven: orta. Risk: yüksek.**

Mevcut dosyalar: app.bundle.js 3831687 bayt (~3.65 MiB), core-js.bundle.js 156538 bayt, CSS 598302 bayt. Paket yerelden geldiği için yalnız indirme değil parse/compile ve ilk DOM kurulumu önemlidir.

`build.mjs`, IIFE tek uygulama bundle'ı üretiyor; debug bundle/source map desteği zaten var. İlk 2.3 s takılmanın bundler, Home snapshot uzlaştırma, veri yenilemesi veya GC kaynaklı olduğu ayrılmalı. Debug paketinin hızı production ile doğrudan kıyaslanmamalı.

Öneri: boot aşamalarını işaretle, ilk gezinme boyunca trace al. Oyuncu/plugin/ağır ayrıştırıcı kodunu ayrı ve talep üzerine yüklenen paketlere ayırma ancak kaynak dağılımı ölçülünce yapılmalı. Yalnız bu 2020 TV için build target'ını yükseltmek projenin eski TV desteğini sessizce değiştireceğinden önerilmiyor.

## Elenen veya bu TV'de önceliği düşük seçenekler

- `content-visibility:auto`: canlı CSS.supports false. Tek CSS satırı bu TV'nin çözümü değil.
- preventScroll tespitini değiştirmek: detached div, focusable detached div ve mevcut aktif eleman testleri true; odak değişmedi. Yardımcı destek tespitinde hata bulunmadı. Native focus'un önceki kayıtta pahalı olması, bu tespitin yanlış olduğunun kanıtı değil.
- Home resim worker'ını daha fazla paralelleştirmek: shouldRescaleHomeArtwork bu constrained profil için zaten false. Bu cihazda kapalı patikayı optimize etmek gezintiyi hızlandırmaz.
- Eklenti paralelliğini tekrar artırmak: constrained Search zaten 6 eşzamanlı istek kullanıyor. Daha fazla yanıt aynı anda JSON parse/render yükünü büyütebilir; önce DOM güncellemesi düzeltilmeli.
- Genel “daha fazla cache”: belleği ve eski veri riskini artırabilir. Her cache için sınır, invalidation ve bellek ölçümü gerekli.
- 31 bin node = bellek sızıntısı demek: tek sayım buna yetmez. Aynı gezinme döngüsünün öncesi/sonrası ve tutan referanslar gerekir.

## Önerilen uygulama sırası ve kabul testi

1. Fragman/expanded kayıtları; ardından Search satırlarını DOM'da koruma. Görece küçük değişiklik, ölçülebilir gereksiz işi hedefliyor.
2. Görsel ölçüm-yazım ayrımı ve kritik tuş yolundaki işleri sınırlama.
3. Gerçek kart/satır DOM penceresi; uzun gezinme, geri dönüş ve bellek testleriyle.
4. Home GPU A/B deneyleri ve ilk uzun takılmanın aşama bazında analizi.
5. Sonuç gerektiriyorsa Home snapshot yapısı ve açılış bundle'larının ayrılması.

Aynı sabit katalog verisiyle aynı tuş dizisi en az üç kez; ilk kullanım ve sıcak kullanım ayrı. Ölçümler: keydown→ilk görünür odak değişimi, p90/p99/max kare, >100 ms uzun görevler, layout/style/paint/GPU süreleri, canlı/park edilmiş kartlar, heap ve resim belleği yaklaşıkları. JS heap toplam TV belleği değildir; native görüntü/video/GPU tüketimi de hesaba katılmalı. [Samsung kaynak yönetimi rehberi](https://developer.samsung.com/smarttv/develop/ai-tv-platform-standards/hw-resource-management.html) bu ölçüm sınırını özellikle belirtiyor.

Mikro ölçümlerdeki 2.275 veya 1.510 ms değerleri FPS yüzdesine çevrilmemeli. Üretim değişikliği için işlevsel testler yanında aynı TV'de A/B ölçümü gereklidir.
