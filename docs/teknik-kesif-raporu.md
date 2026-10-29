# Sorvia Desktop — Teknik Keşif Raporu

Tarih: 29 Ekim 2026 · Hazırlayan: Claude (kod ve canlı veritabanı incelemesine dayanır)

Bu rapor, Sorvia Desktop'a başlamadan önce mevcut Sorvia sistemlerinin **gerçekte** ne yaptığını belgeler. Her madde kodda ya da canlı sistemde doğrulandı. Doğrulanamayanlar ayrı bölümde.

## 1. Özet

- Çalışanların kimliği, rolleri ve iş kayıtları **Sorvia.net** uygulamasında (Next.js 16 + PostgreSQL) tutuluyor. Sorvia Desktop bu sistemin istemcisi olacak.
- Masaüstünün kullanabileceği hazır bir API **yok**. Yönetim uçları tarayıcı çerezine ve aynı köken denetimine bağlı; sunucu eylemleri (server actions) dışarıdan çağrılamaz. Masaüstü için `/api/desktop/*` altında jetonla (Bearer) çalışan yeni uçlar gerekiyor.
- Giriş için mevcut güvenlik katmanı (2FA, geçiş anahtarı, cihaz doğrulama) yeniden yazılmayacak: masaüstü **cihaz bağlama akışı** kullanacak. Kullanıcı tarayıcıda sorvia.net'e kendi girişiyle girip bilgisayarı onaylar. Masaüstü oturumu mevcut `Session` tablosunda tutulur, böylece hesap güvenliği sayfasından görülüp kapatılabilir.
- **Görev sistemi** veritabanında tanımlı (`InternalTask`) ama hiçbir kod kullanmıyor ve kayıt yok. Masaüstü, görevlerin ilk arayüzü olacak.
- Kurumsal e-posta `mail.sorvia.net` üzerinde **Dovecot (IMAP 993, IDLE destekli)** ve **SMTP (465/587)**. OAuth yok; kullanıcı adı ve parola ile bağlanılır.
- Teknoloji: **Electron + React 19 + TypeScript + Tailwind 4**. Tauri 2 daha hafif ama bu makinede Rust ve MSVC derleme araçları yok; gerekçe 7. bölümde.

## 2. Mevcut sistemlerin gerçek mimarisi

| Sistem | Ne | Nerede | Masaüstü için önemi |
| --- | --- | --- | --- |
| Sorvia.net (`sorvia-netweb`) | Site, müşteri paneli, yönetim (`/admin`), kurucu paneli (`/owners`), personel alanı (`/personel`) | sorvia2 sunucusu (Debian 13), `/opt/sorvia`, PostgreSQL `sorvia` | **Ana kaynak**: kullanıcılar, roller, destek talepleri, görüşmeler, bildirimler, ekip sohbeti, görev şeması |
| Command Center (`sorviayt`) | Altyapı paneli: projeler, entegrasyonlar, Nöbet izleme, bilgi grafiği, posta hesapları | Aynı sunucu, ayrı veritabanı `command_center`, ayrı kullanıcılar | İkinci aşama: Nöbet, olaylar. Kendi API anahtarı sistemi var (`scc_live_…`, kapsamlı) |
| srv-system (SorviaPanel) | Eski .NET + React panel | Yerel depo, `Srv-system` | Command Center'a taşınmış; masaüstü için kullanılmayacak |
| Posta sunucusu | Dovecot IMAP + SMTP | `mail.sorvia.net` (87.121.103.5) | Sorvia Mail modülü |
| 9Router | Yapay zekâ ağ geçidi | `ai.sorvia.dev` | İleride masaüstü asistanı |

Canlı veritabanında (29.10.2026): 6 personel hesabı, 1 açık destek talebi, 3 görüşme, 40 bildirim, **0 görev**, **0 ekip sohbeti mesajı**, **0 wiki sayfası**.

## 3. Kullanılabilir servisler ve API'ler

| Uç | Kimlik doğrulama | Masaüstünden kullanılabilir mi? |
| --- | --- | --- |
| `/api/v1/*` (lisans, durum, ürünler) | Kullanıcı API anahtarı (`X-Sorvia-Key`, kapsamlı) | Personel işleri için değil; müşteri entegrasyonları için |
| `/api/admin/*` (yüklemeler, hata bildirimi) | Tarayıcı çerezi + aynı köken (`staffApi`) | Hayır, çerez gerekiyor |
| Sunucu eylemleri (`src/actions/*`) | Tarayıcı çerezi | Hayır |
| `/api/meetings/feed` | İmzalı takvim aboneliği (.ics) | Okuma için evet |
| Command Center `/api/v1/*` | `scc_live_` anahtarı + kapsam | Evet, kapsamlı anahtarla (ikinci aşama) |

**Sonuç:** Masaüstü için Sorvia.net'e yeni bir API katmanı eklenmeli. İş mantığı yeniden yazılmayacak; uçlar mevcut servis fonksiyonlarını ve aynı yetki denetimini (`can()`) çağıracak.

## 4. Kimlik doğrulama ve rol modeli

- **Oturum:** Rastgele jeton çerezde, SHA-256 özeti `Session.tokenHash` alanında. Süre 30 gün. Oturum iptal edilebilir (`revokedAt`). Kurucunun müşteri hesabına girmesi (`impersonatorId`) destekleniyor.
- **Ek güvenlik:** TOTP iki adımlı doğrulama, geçiş anahtarı (passkey), güvenilir cihaz, cihaz doğrulama e-postası, Google ile giriş.
- **Roller:** `CUSTOMER(10) < DEVELOPER(40) < SUPPORT(50) < MODERATOR(60) < ADMIN(90) < OWNER(100)`. Personel = Geliştirici ve üstü.
- **İzinler:** `src/lib/auth/rbac.ts` içinde 40 izin; her biri en düşük role bağlı (ör. `tickets.reply` → Destek, `tickets.assign` → Moderatör). Ek olarak:
  - **Özel roller** (`CustomRole.permissions`).
  - **Kişiye özel izinler** (`UserGrant`).
  - Kurucuya özel izinler devredilemez.
- **Masaüstü kararı:** Yetki her istekte sunucuda `can()` ile denetlenir; arayüzdeki gizleme yalnızca kolaylıktır. Menüdeki modüller sunucunun döndürdüğü izin listesinden oluşur.

## 5. Modüllerin durumu

| Modül | Durum | Veri kaynağı | Not |
| --- | --- | --- | --- |
| Destek talepleri | **Çalışıyor** | `Ticket`, `TicketMessage`, departmanlar, yapay zekâ karşılaması, Discord konuları | Atama (`assigneeId`), öncelik, durum, yanıt var |
| Görüşmeler | **Çalışıyor** | `Meeting` (`handledById`) | Takvimin tek gerçek etkinlik kaynağı |
| Bildirimler | **Çalışıyor** | `Notification` (kullanıcıya özel) | Anlık itme yok; masaüstü yoklama yapacak |
| Görevler | **Yalnızca şema** | `InternalTask` (pano, durum, öncelik, sorumlu, son tarih) | Kod ve kayıt yok; masaüstüyle hayata geçecek |
| Projeler | **Yok** | — | Çalışan projesi modeli yok. Görev panoları (`board`) proje gibi kullanılabilir; Command Center'daki projeler altyapı içindir |
| Ekip sohbeti | **Arayüz var, kullanılmıyor** | `StaffChannel`, `StaffMessage` | Anlık değil; yoklama |
| Wiki | **Yalnızca şema** | `WikiPage` | İleride |
| Kurucu görevleri ve hatırlatmaları | **Çalışıyor (yalnız kurucu)** | `FounderTask`, `FounderReminder` | Yalnız `founder.access` |
| Personel bilgileri | **Çalışıyor** | `StaffOnboarding`, `/personel/bilgilerim` | Profil ekranında gösterilebilir |
| Takvim entegrasyonu | **Yok** | — | Google/Outlook bağlantısı yok; görüşmeler .ics ile dışa veriliyor |

## 6. Kurumsal e-posta

- `MX → mail.sorvia.net (87.121.103.5)`.
- IMAP 993: `Dovecot ready`, yetenekler `IDLE`, `AUTH=PLAIN`, `AUTH=LOGIN`. IDLE sayesinde yeni posta anında fark edilebilir.
- SMTP 465 ve 587 açık. Site bildirimleri 465 üzerinden gidiyor ve SPF/DKIM geçiyor.
- OAuth yok; kullanıcı adı ve parola kullanılacak. Parola Windows'ta kullanıcının hesabına bağlı DPAPI ile şifrelenip yalnız o bilgisayarda saklanacak.
- Command Center'da hazır bir IMAP/SMTP istemcisi var (`imapflow`, `nodemailer`, `mailparser`). Masaüstü aynı kütüphaneleri ana süreçte kullanacak.
- **Eksik:** Hangi çalışanın hangi posta kutusuna sahip olduğu hiçbir yerde tutulmuyor. İlk sürümde çalışan kendi adresini ve parolasını girer. İsterseniz Sorvia.net'te personele "kurumsal adres" alanı ekleyip önerilen adresi otomatik doldurabiliriz.

## 7. Masaüstü teknolojisi

| Seçenek | Artı | Eksi | Bu makinede |
| --- | --- | --- | --- |
| **Tauri 2** + React | Küçük paket (~10 MB), Rust ana süreç, sıkı izin modeli, WebView2 | Rust + MSVC C++ derleme araçları gerekir (~6 GB, yönetici kurulumu) | Rust ve MSVC **yok** |
| **Electron** + React | Hiçbir sistem kurulumu gerekmez; olgun güncelleme (electron-updater), NSIS kurulum, DPAPI'li `safeStorage`, sistem tepsisi, bildirim, Windows 11 Mica/Acrylic | Paket büyük (~90 MB), bellek daha yüksek | Node 25 + npm hazır |
| WPF/WinForms + WebView2 (.NET 10) | Hafif, yerel C# | Köprü, güncelleme ve güvenlik altyapısı elle yazılır | .NET 10 var |

**Karar: Electron.** Bugün derlenip test edilebilen tek seçenek bu ve Windows entegrasyonunun tamamını hazır veriyor. Arayüz React/TypeScript ile yazıldığı ve yerel çağrılar tek bir köprü (`window.sorvia`) arkasında toplandığı için, ileride derleme araçları kurulursa kabuk Tauri 2'ye taşınabilir; arayüz kodu değişmez.

Güvenlik ayarları: `contextIsolation`, `sandbox`, `nodeIntegration: false`, sıkı CSP, dışarı gezinme engeli. Oturum jetonu ve e-posta parolası **yalnızca ana süreçte** durur; arayüz onları hiç görmez.

## 8. Önerilen mimari

```
Windows (Electron)
 ├─ Ana süreç (Node)          : jeton saklama (DPAPI), API istemcisi, IMAP/SMTP, tepsi, bildirim, kısayol, güncelleme
 ├─ Köprü (preload)           : window.sorvia — tipli, dar bir yüzey
 └─ Arayüz (React, sandbox)   : My Sorvia, görevler, takvim, talepler, posta, sohbet, ayarlar
        │  HTTPS + Bearer jeton
        ▼
Sorvia.net /api/desktop/*     : cihaz bağlama, me, home, görevler, talepler, bildirimler, takvim, sohbet
        │  can() izin denetimi, mevcut servis fonksiyonları, denetim kaydı
        ▼
PostgreSQL (mevcut tablolar)  ·  mail.sorvia.net (IMAP/SMTP, doğrudan ana süreçten)
```

**Cihaz bağlama akışı:**
1. Masaüstü `POST /api/desktop/auth/start` → cihaz kodu (gizli) + kullanıcı kodu (ör. `K7QM-4X2P`).
2. Tarayıcıda `sorvia.net/masaustu/baglan` açılır. Kullanıcı kendi girişiyle (2FA dahil) girer, kodu ve cihaz adını görüp onaylar. Yalnız personel onaylayabilir.
3. Masaüstü `POST /api/desktop/auth/token` ile yoklar. Onaydan sonra yeni bir `Session` satırı oluşur ve jeton bir kez teslim edilir.
4. Hesap güvenliği sayfasında oturum "Sorvia Desktop · Windows" olarak görünür ve oradan kapatılabilir.

Bu akış için yeni tablo gerekmez; bekleyen istekler mevcut `VerificationToken` tablosunda (`purpose: desktop-auth`) tutulur.

## 9. Güvenlik riskleri ve önlemler

| Risk | Önlem |
| --- | --- |
| Diskteki jetonun çalınması | DPAPI (`safeStorage`) — yalnız o Windows kullanıcısı çözebilir; 30 gün süre; sunucudan iptal |
| Arayüzde XSS (özellikle e-posta HTML'i) | Arayüz jeton görmez; e-posta HTML'i temizlenir ve betiksiz `sandbox` iframe'de gösterilir; dış görseller varsayılan kapalı; sıkı CSP |
| Yetkisiz veri | Her uçta sunucu tarafı `can()`; kullanıcıya ait olmayan kayıtlar sorguda filtrelenir; personel olmayan hesap bağlanamaz |
| Çalınan cihaz | Hesap güvenliği sayfasından oturum iptali; rol düşürülürse bir sonraki istekte yansır |
| Kaba kuvvet / kod tahmini | Kullanıcı kodu 10 dk geçerli, tek kullanımlık, hız sınırlı; cihaz kodu 32 bayt rastgele |
| İmzasız kurulum | Kod imzalama sertifikası yok → SmartScreen uyarısı. Üretim dağıtımı için EV/OV sertifika önerilir |
| Güncelleme bütünlüğü | electron-updater SHA-512 doğrulaması; imza sertifikası gelince imza denetimi eklenir |
| Ortak bilgisayar | Çıkışta yerel önbellek ve kayıtlı posta parolası silinir; önbellek kullanıcı kimliğine göre ayrılır |

## 10. Klasör yapısı

```
srv-desktop/
├─ electron/          ana süreç ve köprü (TypeScript)
│  ├─ main.ts         pencere, tepsi, kısayollar, güvenlik
│  ├─ preload.ts      window.sorvia köprüsü
│  ├─ auth.ts         cihaz bağlama, jeton saklama
│  ├─ api.ts          Sorvia.net istemcisi
│  ├─ mail.ts         IMAP/SMTP
│  └─ secure-store.ts DPAPI ile şifreli depolama
├─ src/               arayüz (React)
│  ├─ design/         tasarım sistemi: belirteçler ve bileşenler
│  ├─ shell/          başlık çubuğu, dock, başlatıcı, komut paleti, bildirim merkezi
│  ├─ screens/        My Sorvia, görevler, takvim, talepler, posta, sohbet, ayarlar, bağlanma
│  └─ data/           köprü istemcisi, önbellek, önizleme verisi (ayrı ve etiketli)
├─ docs/              bu rapor, tasarım sistemi, API sözleşmesi
└─ build/             ikonlar, kurulum ayarları
```

## 11. Geliştirme planı

| Aşama | İçerik | Durum |
| --- | --- | --- |
| 1 | Keşif raporu | Tamamlandı (bu belge) |
| 2 | Tasarım sistemi, pencere, dock, başlatıcı, komut paleti, bildirim merkezi, ekranlar | Tamamlandı |
| 3 | `/api/desktop/*`: cihaz bağlama, me, home, görevler, talepler, bildirimler, takvim | `masaustu-api` dalında, 89 kontrollük testle; canlıya alınmadı |
| 4 | Sorvia Mail (IMAP/SMTP), ekip sohbeti, talebe yanıt | Tamamlandı; posta gerçek IMAP/SMTP sunucusuna karşı test edildi |
| 5 | Tepsi, yerel bildirim, açılışta çalıştırma, güncelleme, kurulum paketi | Hazır; güncelleme şimdilik bildirim + indirme bağlantısı |
| 6 | Uçtan uca testler, kod imzalama, dağıtım | Uçtan uca test hazır; imza sertifikası ve canlı dağıtım bekliyor |

**Önizleme verisi kuralı:** Bağlanmadan tasarımı görmek için "Önizleme" modu var. Bu modda ekranın üstünde sürekli "Önizleme verisi" uyarısı görünür; önizleme verisi gerçek veriyle hiçbir zaman karışmaz ve bağlanınca tamamen kaldırılır.

## 12. Açık sorular

- Çalışanların kurumsal posta kutuları kimde ve nasıl açılıyor? (87.121.103.5 sunucusuna erişimim yok.)
- Görev panoları (proje gibi) hangi adlarla başlasın? Ör. "Web", "Eklentiler", "Destek".
- Kod imzalama sertifikası alınacak mı? Güncellemeler hangi adresten dağıtılsın? Önerim: `sorvia.net/indir/masaustu`.
- Command Center hesapları ile Sorvia.net personel hesapları eşleştirilsin mi? (İkinci aşama.)
