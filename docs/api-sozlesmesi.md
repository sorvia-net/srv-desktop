# Masaüstü API sözleşmesi

Sunucu: Sorvia.net, `src/app/api/desktop/*` (dal: `masaustu-api`). Tipler: `shared/contracts.ts`.

Tüm uçlar JSON döner ve `Cache-Control: no-store` taşır. Başarılı yanıtın gövdesi doğrudan veridir. Hata yanıtı `{ "error": "<kod>", "message": "<Türkçe açıklama>" }` biçimindedir ve HTTP durumu anlamlıdır (400, 401, 403, 404, 413, 429).

## Kimlik

`auth/*` dışındaki her uç `Authorization: Bearer <jeton>` ister. Jeton yalnızca cihaz bağlama akışıyla açılmış bir `Session` satırına karşılık gelirse geçerlidir (`browser = "Sorvia Desktop"`, `deviceType = "app"`). Oturum iptal edilmiş, süresi dolmuş, hesap askıya alınmış ya da personellikten çıkarılmışsa yanıt `401` olur; masaüstü bu durumda oturumu kapatır.

Yetki her istekte sunucuda `can()` ile denetlenir. Arayüzdeki modül listesi (`user.modules`) yalnızca kolaylıktır.

### Cihaz bağlama

| Uç | Gövde | Yanıt |
| --- | --- | --- |
| `POST /api/desktop/auth/start` | `{ device, version, platform }` | `{ deviceCode, userCode, verificationUrl, verificationUrlComplete, expiresIn, interval }` |
| `POST /api/desktop/auth/token` | `{ deviceCode }` | Onaylandıysa `{ token, expiresAt, user }`; değilse 400 ve `error` |
| `POST /api/desktop/auth/logout` | — | `{ ok: true }`, oturum iptal edilir |

`token` hata kodları: `authorization_pending` (bekle), `slow_down` (aralığı aç), `expired_token`, `access_denied`, `invalid_grant`. İstek 10 dakika geçerli, kullanıcı kodu tek kullanımlık; başlatma IP başına 10 dakikada 10 kez ile sınırlı.

Kullanıcı `verificationUrlComplete` adresinde (`/masaustu/baglan?kod=XXXX-XXXX`) kendi oturumuyla kodu görür ve onaylar ya da reddeder. Yalnızca personel onaylayabilir. Onaydan sonra kullanıcıya "Sorvia Desktop bağlandı" güvenlik bildirimi düşer ve oturum Hesap güvenliği sayfasında görünür.

## Uçlar

| Uç | Yetki | Açıklama |
| --- | --- | --- |
| `GET /me` | personel | `{ user: DesktopUser, expiresAt }` |
| `GET /home` | personel | `HomeSummary`: sayaçlar, görevler, talepler, ajanda, bildirimler, panolar, altı haftalık ritim, destek hedefi |
| `GET /tasks?scope=mine\|created\|all` | `all` için Moderatör | Görevler (`InternalTask`); tamamlananlar 30 gün görünür |
| `POST /tasks` | personel | `{ title, board?, priority?, dueAt?, description?, assigneeId? }`; başkasına atama Moderatör ister |
| `PATCH /tasks/:id` | sahip, oluşturan ya da Moderatör | `status`, `priority`, `title`, `dueAt`, `board`, `description`, `assigneeId` |
| `GET /tickets?scope=mine\|waiting\|open\|all` | `tickets.view` | Talep özetleri, son 100 |
| `GET /tickets/:id` | `tickets.view` | Yazışma dahil talep; iç notlar görünür |
| `POST /tickets/:id/reply` | `tickets.reply` | `{ body, internal?, status? }`; yönetim panelindeki yanıtla aynı çekirdek (`replyAsStaff`): bildirim, Discord, e-posta, audit |
| `GET /calendar?from&to` | personel | Görüşmeler (`meetings.view`), görev son tarihleri, kurucu hatırlatmaları (`founder.access`); aralık en çok 100 gün |
| `GET /notifications?unread&limit` | personel | Son bildirimler (en çok 50) |
| `POST /notifications/read` | personel | `{ ids: string[] \| "all" }` |
| `GET /chat` | `chat.use` | Rolün yettiği kanallar ve okunmamış sayısı |
| `GET /chat/:id` | `chat.use` | Son 100 ileti; kanal okundu sayılır |
| `POST /chat/:id` | `chat.use` | `{ body }`; panel sohbetiyle aynı çekirdek (`postToChannel`), dakikada 40 ileti |
| `GET /version` | herkese açık | `{ latest, url, notes }`; `SiteSetting` `desktop.release` yoksa 404 |

## Pano adları

Görev panoları serbest metindir. Veritabanındaki varsayılan `general`, API'de "Genel" olarak görünür; "Genel" gönderilirse `general` yazılır.

## Sürüm yayınlama

Yeni bir kurulum dosyası yayınlandığında `SiteSetting` içine şu kayıt yazılır; uygulamalar 6 saatte bir bakar ve kullanıcıya bildirim gösterir. Adres yalnızca `https://sorvia.net` ya da alt alan adı olabilir.

```json
{ "key": "desktop.release", "group": "desktop", "value": { "version": "0.2.0", "url": "https://sorvia.net/masaustu", "notes": "Kısa açıklama" } }
```

## Testler

- Sunucu: `npx tsx tests/desktop-api.ts` (geliştirme veritabanı; 89 kontrol, onay ile yoklamanın yarışı dahil).
- Uçtan uca: masaüstü → web onayı → gerçek veriyle tüm modüller → çıkış; posta için Ethereal test hesabı.
