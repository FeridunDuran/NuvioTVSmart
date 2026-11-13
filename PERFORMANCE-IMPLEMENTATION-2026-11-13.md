# Performans paketinin uygulanması — 2026-11-13

Kapsam: NuvioTVSmart / turbo, Samsung Q70T / Tizen 5.5 / Chromium 69. Önceki yerel değişiklikler korundu. Commit/push yapılmadı.

## Kullanıcı davranışları

- P2P istatistik paneli yalnız kontroller görünürken gösterilir. setControlsVisible paneli aynı anda eşitler; veri değişmese de gizlenir. Kontroller kapalı ve başlangıç yüklemesi bitmişse isteğe bağlı UI istatistik sorguları durur; playback stall/keepalive işlevleri korunur.
- Hareketsizlikteki poster gösterisinin ayarı zaten var: Settings → Ambient Mode → off; Türkçe Ayarlar → Ortam Modu → kapalı. İstek uyarınca seçenek bildirildi; özellik koddan kaldırılmadı ve kullanıcının tercihi değiştirilmedi.

## Uygulanan performans işleri

| Alan               | Sonuç                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fragmanlar         | Yüklü medya ve genişlemiş kart Set'leri. Boş Home'da 516 placeholder'ı her tuşta yeniden tarama kaldırıldı. İlk durum taraması ve route cleanup korunuyor. Boş katman için gereksiz cleanup zamanlayıcısı da başlatılmıyor.                                                                                                   |
| Görsel tahliyesi   | Önce bütün satır geometrileri okunuyor, ardından resim kaynakları bırakılıyor. Okuma/yazım sırası test edildi.                                                                                                                                                                                                                |
| Search             | Kararlı stateKey ile mevcut section/card DOM'u korunuyor. Geç gelen kataloglar yalnız yeni satır ekliyor; watched işaretleri yerinde değişiyor. Input/IME, odak ve scroll korunuyor.                                                                                                                                          |
| Home DOM penceresi | Constrained TV'de uzak kartların iç DOM'u kaldırılıyor, yaklaşınca tekrar kuruluyor. Kartın sığ navigasyon kabuğu/dataset'i tutulduğu için odak referansları bozulmuyor. Bu, bütün kart kabuklarını DOM'dan kaldırmak değildir. Son odaklanan dört satır korunarak hızlı aşağı/yukarı dönüşte tekrar parse/decode sınırlandı. |
| Home snapshot      | Her düğüm için ikinci native DOM kopyası yerine sade attribute/style/class verisi tutuluyor. Boş stiller ortak; class token cache'i 512 ile sınırlı. İlk render inert belgede bir kez parse edilip aynı ağaç canlı belgeye taşınıyor.                                                                                         |
| Senkron layout     | Constrained CSS zaten poster geçişlerini kapattığından, collapse sırasında ek transition yazımı/offsetWidth zorlaması kaldırıldı.                                                                                                                                                                                             |
| Açılış             | Oynatıcı ekranının büyük yöntem/factory kurulumu ilk player mount'a ertelendi. Tek modül grafiği ve PlayerController tekilliği korunuyor; route'tan erken çıkılırsa geç gelen mount uygulanmıyor. Eski TV desteği korundu.                                                                                                    |

Başlangıç paketi fiziksel olarak çoklu dosyalara ayrılmadı. Legacy IIFE hedefinde esbuild modülleri aynı dosyada tutuyor; uygulanan kazanım, oynatıcı ekranının eager kurulumunun ertelenmesidir. Paket dosyası küçüldü veya parse süresi belirli yüzde azaldı iddiası yok.

## GPU deneyi

Home track'lerinde translateZ(0)/will-change kaldırma adayı TV'de geçici stylesheet ile denendi. Aynı tuş dizisinde temel p90 85 ms / p99 183 / max257; aday p90 82 / p99 210 / max237. UpdateLayerTree toplamı adayda arttı. Belirgin ve tutarlı kazanç bulunmadığından CSS adayı geri alındı; üretim kaynağına eklenmedi.

## Doğrulama

- npm run test:perf: 175 test geçti.
- Search submit, progressive publication, Tizen IME Back/Done, Home snapshot kontrolleri geçti.
- npm run test:tv:dom: gerçek Chromium 69 üzerinde 18 DOM kontrolü geçti. Bu test inert belgede çalışır; canlı uygulama DOM'unu değiştirmez.
- Test aracı: scripts/run-tv-dom-performance-smoke.mjs; varsayılan CDP http://127.0.0.1:9333. Önce sdb forward kurulmalı. NUVIO_TV_CDP_URL ile adres değişebilir.
- npm run lint ve Tizen paketleme başarılı. Genel npm test hâlâ depoda bulunmayan tests/test-plugin-system.mjs dosyasında duruyor; bu eski eksiklik gizlenmedi ve testler atlanmadı.

## Canlı TV gözlemleri

- İlk kurulumdan sonra Home 506 kart kabuğu tuttu; 472 kartın içeriği sanallaştırılmıştı. Home iç element sayısı 1162; gezinti sonrası bir örnekte1545. Araştırma öncesi örnek6338 idi. Katalog sayıları birebir aynı olmadığı için kesin yüzde verilmiyor.
- Isınmış örnekte CDP node9505, JS heap yaklaşık22.2MiB görüldü. Önceki farklı ekran örneğiyle doğrudan bellek kazancı oranı hesaplanmadı; native/GPU toplam belleği de bu sayı değildir.
- Yeni akışta ilk Home paint yaklaşık3.85s; önceki aynı koşullu açılış kaydı olmadığından hızlanma yüzdesi yok.
- İlk yeni Home profilleri p9085–86ms, max227–257ms idi. Önceki farklı veri/oturum kaydındaki64ms'den daha iyi değildi; genel FPS artışı iddia edilmiyor. Son dört satır önbelleği bu ölçümlerden sonra eklendi; son paket tekrar ölçülecek.
- Search ilk canlı denemede watched yenilemesi5 satır değiştiriyordu; bunun üzerine badge yerinde güncelleme eklendi. Sonraki denemede5 satır,0 satır değişimi ve aynı input düğümü doğrulandı; ilk sonuç414ms.
- Gerçek P2P video AVPlay PLAYING durumunda oynadı. İstatistik ayarı test için geçici açıldı: kontroller açıkken stats hidden=false/aria-hidden=false; auto-hide sonrasında ikisi de hidden=true ve stats aria-hidden=true. CSS hidden paneli opacity0 yapar; display:block kalması görünür olduğu anlamına gelmez. Test ayarı eski değerine döndürüldü.

## Sınırlar

Sanallaştırmada kart kabukları erişilebilir/navigasyon dayanağı olarak korunuyor. Modern TV profilleri gereksiz yere bu constrained politikaya geçirilmedi. GPU önerilerinin tamamını körlemesine uygulamak yerine, kazancı çıkmayan aday geri alındı. Performans doğrulaması uygulama işlevselliğinin ve ölçüm belirsizliklerinin önüne geçirilmedi.

Son durum: son dört odak satırı cache'i ve legacy hero dwell300/350ms pakete eklendi. Constrained hızlı gezinme eşiği300ms; preload ara kartlarda başlamıyor. Kullanıcı ek testleri durdurup yalnız kurulum istedi. Son WGT TV'ye başarıyla yüklendi ve açıldı; bu son dwell değişikliğinin TV doğrulamasını kullanıcı yapacak. Kurulumdan sonra uygulamada gezinilmedi ve ek ölçüm yapılmadı.

## Detay ekranı ilk açılış

- Elde bulunan route görselleri/başlık veya metadata cache ilk await öncesinde çizilir; geçici skeleton parse edilmez.
- Tam metadata çizimi kütüphane, resume ve izlenmiş geçmişinin tamamlanmasını beklemez. Son düzeltmede provisional Enter/pointer/keyup engeli kaldırıldı; Back/Play/gezinme genel yükleme kilidiyle bekletilmez. İlk tamamlanmamış ekran route snapshot'ı olmaz.
- Kaynak metanın eksik arka planı için owner metadata beklemesi arka plana taşındı. Eksik görseller, açıklama, genres ve videos tamamlanır; geç gelen sonuçlar detailLoadToken ile korunur, sonraki enrichment eksik alanları silmez.
- Global eklenti araması: ilk adaya 350ms öncelik, sonra iki eşzamanlı probe sınırıyla ilk başarılı yanıt. Kaynak-yeterli recommendation sınırı korunur.
- Tam meta aynı layout'taysa mevcut section updater kullanılır; yeniden tam DOM kurulmaz.
- Kullanıcı isteği gereği yeni test veya performans ölçümü yapılmadı. Üretim paket derlemesi başarılı. Gerçek TV hız kazanımı henüz ölçülmedi.

## Detay yüklenirken giriş engelinin kaldırılması

Kullanıcı hızlı ilk çizimi doğruladı ancak kısa süre Back/Play çalışmadığını bildirdi. Önceki provisional Enter/pointer/keyup engeli kaldırıldı; metadata ve geçmiş yüklenirken giriş açık. Film Play doğrudan kaynak listesine gider, resume bilgisi kaynak seçiminin kendi sorgusunda tamamlanır. Detaydaki loading-Back dalının mevcut history entry'yi yeniden mount etmesi giderildi.

Ortak route-return koruması artık mount süresince sonsuz değildir; yeni fiziksel Back basışı yüklemeyi beklemez, duplicate key/history korumaları korunur. Yavaş mount sırasında Back caller history entry'yi geri yükler. Stream'e geri dönüşte isteğe bağlı logolar paint/mount bekletmeden arka planda yüklenir. İlk izleme/kütüphane verileri kullanıcı mutation token'ları değiştiyse mevcut seçimi ezmez.

Üretim derlemesi başarılı; kullanıcının isteği gereği test veya TV ölçümü yapılmadı.

## İçerik/menü beklemeleri ve Home dönüş yolu

Discover, Catalog See All ve Folder Detail provider istekleri izleme geçmişiyle paralel başladı. Search 220ms sabit aktivasyon kilidi kaldırıldı. İsteğe bağlı logo proxy hazırlığı Stream aramasını bekletmez. Menülerin bağımsız saved/watched/source-mode/list/membership sorguları paralelleştirildi; Back/route/generation kontrolleri eski isteklerin menüyü yeniden açmasını engeller.

Kullanıcının açılış/Geri gecikmesi geri bildirimi üzerine korunmuş Home ekranında aynı seçili kart için tam focus restore atlandı. Focus snapshot tekrarları kaldırıldı; track offset restore yalnız değişen scroll değerlerini yazar ve lookup Map kullanır. Home arka plan/kozmetik resume işleri ilk paint sonrasına ertelendi. Detail chrome ölçümleri ilk paint sonrasına coalesce edilerek eski route işlerine karşı korundu.

Yalnız üretim derlemesi ve paketleme yapıldı; kullanıcı isteği gereği test veya TV performans ölçümü yok. Instant geçiş doğrulanmadı.

## Ana ekran yön tuşları

Kullanıcı Samsung TV'de animasyon yerine anlık dört yön gezinmeyi istedi. Tizen Home scroll policy doğrudan hedefe geçer; modern dikey odak kaydırması RAF beklemez. Basılı tuş tekrar eşiği yatay64ms/dikey80ms; tek basışlarda ek bekleme yok. Aynı satır yatay gezinmede gereksiz dikey geometry ve row-window hazırlığı atlanır. Yatay artwork hydration settle sonrasına alınır. Hero görsel dwell ve fragman gecikmeleri kaldırılmadı.

Üretim derlemesi başarılı; kullanıcı isteği gereği test veya TV ölçümü yapılmadı.

## Soğuk açılış

Home snapshot disk okuması live/deferred katalog pipeline'ından tamamen ayrıldı; snapshot'ın2500ms timeout'u sonraki kaynak grubunu bekletmez. IndexedDB açılışı bootstrap sırasında, içerik okumadan erkenden başlatılır. İlk Home hazır bildirimi sonrası isteğe bağlı başlangıç işlerine paint fırsatı ve250ms başlangıç aralığı verilir; hepsi aynı karede başlamaz.

Cache'te PIN'siz olduğu bilinen profil için canlı kilit sorgusu race300ms oldu; PIN'li/bilinmeyen profillerin canlı kontrolü ve geç PIN enforcement'ı korunur. Auth/session doğrulaması değiştirilmedi.

Paket derlemesi başarılı; kullanıcı isteği gereği test veya soğuk açılış ölçümü yapılmadı.
