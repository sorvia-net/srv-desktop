# Sorvia Desktop

Sorvia ekibinin Windows çalışma alanı: My Sorvia özeti, görevler, takvim, destek talepleri, Sorvia Mail, ekip sohbeti ve ayarlar tek pencerede.

Uygulama Sorvia.net'in istemcisidir. Kimlik, yetki ve veriler sunucuda kalır; masaüstü yalnızca `/api/desktop/*` uçlarını Bearer jetonla çağırır. Posta, ana süreçten doğrudan `mail.sorvia.net` (IMAP 993, SMTP 465) ile konuşur.

## Çalıştırma

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Vite (5199) ve Electron'u birlikte açar; ana süreç değişince Electron yeniden başlar |
| `npm run web` | Arayüzü tarayıcıda açar. `http://localhost:5199/?onizleme` önizleme verisiyle gezdirir |
| `npm run typecheck` | Arayüz ve ana süreç için ayrı TypeScript denetimi |
| `npm test` | Paylaşılan yardımcılar ve posta içerik temizliği için birim testleri |
| `npm run build` | Denetim + Vite + esbuild; çıktı `dist/` ve `dist-electron/` |
| `npm run dist` | NSIS kurulum dosyası: `release/Sorvia-Desktop-Kurulum-<sürüm>.exe` |

VS Code terminali `ELECTRON_RUN_AS_NODE=1` taşır; `scripts/dev.mjs` bunu siler. Elle `electron .` çalıştırırken değişkeni kaldır.

Geliştirme modunda (yalnızca `VITE_DEV_SERVER_URL` varken) şu değişkenler geçerlidir:

- `SORVIA_SERVER=http://localhost:3100` — yerel Sorvia.net'e bağlanır.
- `SORVIA_MAIL_IMAP=host:port`, `SORVIA_MAIL_SMTP=host:port[:starttls]` — posta motorunu test sunucusuna yönlendirir.
- `SORVIA_E2E=1` — bağlanırken tarayıcı açılmaz (otomatik test için).

Paketlenmiş uygulamada sunucu her zaman `https://sorvia.net`, posta sunucusu her zaman `mail.sorvia.net`.

## Yapı

```
electron/   ana süreç: pencere, tepsi, kısayol, cihaz bağlama, API istemcisi, posta, bildirim, güncelleme
shared/     arayüz ve ana sürecin ortak sözleşmesi (SorviaBridge), bildirim yönlendirme, sürüm karşılaştırma
src/        arayüz: design/ (bileşenler), shell/ (başlık, dock, paletler), screens/, data/ (köprü, önbellek, önizleme)
docs/       keşif raporu, API sözleşmesi, tasarım sistemi
tests/      birim testleri (node --test)
```

## Güvenlik

- Arayüz `sandbox` + `contextIsolation` ile çalışır, Node erişimi yoktur; yalnızca `window.sorvia` köprüsünü görür.
- Üretimde arayüz `sorvia://app` protokolünden yüklenir ve sıkı CSP alır (`connect-src 'self'`): arayüz doğrudan ağa çıkamaz.
- Oturum jetonu ve posta parolası yalnızca ana süreçte, Windows DPAPI (`safeStorage`) ile şifreli durur.
- Ana süreç arayüzden gelen her IPC çağrısında gönderen çerçeveyi doğrular; API yolu `/api/desktop/` dışına çıkamaz.
- E-posta HTML'i ana süreçte temizlenir, betiksiz `sandbox` çerçevede kendi CSP'siyle gösterilir; dış görseller varsayılan kapalıdır.
- Kaydedilen ekler Windows'ta "internetten geldi" olarak işaretlenir; çalıştırılabilir ekler için ayrıca onay istenir.

## Durum

Bağlanma, My Sorvia, görevler, takvim, destek talepleri ve yanıt, ekip sohbeti, Sorvia Mail, bildirimler, tepsi ve kısayollar çalışıyor; yerel sunucuya karşı uçtan uca test edildi. Sunucu tarafı `sorvia-netweb` deposunda `masaustu-api` dalında, henüz canlıda değil. Kod imzalama sertifikası olmadığı için kurulumda SmartScreen uyarısı çıkar.
