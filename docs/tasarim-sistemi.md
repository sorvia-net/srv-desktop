# Tasarım sistemi

Görsel dil, onaylanan referans görsele dayanır: sıcak, koyu bir oda; tavanda örgü bir sarkıt lamba, yanlarda duvar lambaları, sağ altta turuncu bir küre. Arayüz bu sahnenin üstünde yüzen buzlu cam katmanlarından oluşur ve iOS hissi verir. Bu dil değiştirilmez.

## Yapı

- **Başlık çubuğu:** pencerenin üstünde yüzen hap. Solda trafik ışıkları (kapat, küçült, büyüt), başlatıcı, geri/ileri; ortada adres hapı (`sorvia.net/<ekran>`, bağlantı noktası, Ctrl K); sağda bildirim, hızlı görev, uygulama başlatıcı.
- **Dock:** solda dikey cam hap. Etkin modül turuncu dolgulu daire, rozetler turuncu.
- **Ana panel:** 34 px köşeli büyük cam yüzey; ekranlar içinde 26–30 px köşeli kartlar.
- **Katmanlar:** komut paleti, başlatıcı (iOS uygulama ızgarası), bildirim merkezi (sağ çekmece), hızlı görev ve posta yazma sayfaları.

## Belirteçler (`src/styles.css`)

| Belirteç | Değer | Kullanım |
| --- | --- | --- |
| `ink` / `ink-2` / `ink-3` / `ink-4` | `#f6f1ec` `#c9bfb6` `#968c84` `#6f6760` | Metin hiyerarşisi |
| `accent` / `accent-2` / `accent-3` | `#ff7a1a` `#ff9b42` `#ffb877` | Vurgu, etkin durum, rozet |
| `accent-fill` | `#ff9640 → #ff7417 → #f2640a` | Birincil düğme, etkin dock öğesi |
| `ok` `warn` `bad` `info` | `#4ade80` `#fbbf24` `#fb7185` `#7cc4ff` | Durum hapları |
| Köşe | panel 30–34, kart 22–26, karo 16 | |
| Yazı | Inter Variable; başlık 34 px kalın, sıkı aralık | |

Cam sınıfları: `glass-panel` (ana panel), `glass-card` (kart), `glass-strip` (seçili satır, istatistik şeridi), `glass-float` (yüzen hap ve çekmece), `glass-sheet` (okunabilirlik gereken sayfalar: yazma, hızlı görev), `glass-soft` (iç yüzey), `icon-ring` (ikon dairesi).

Duvar kâğıtları: Kor (varsayılan), Alacakaranlık, Gece. Ayarlar'dan seçilir.

## Bileşenler (`src/design/ui.tsx`)

`Button` (accent, glass, ghost, danger; sm, md, lg, icon), `IconButton`, `ActionCircle`, `Pill`, `Avatar`, `Progress`, `Ring`, `Segmented`, `Switch`, `Skeleton`, `Empty`, `Kbd`, `SectionTitle`, `ErrorNote`; grafik için `LineChart` (`src/design/chart.tsx`).

Kurallar:

- Bir düğmenin dolgusunu `className` ile ezme; ikon düğmesi için `size="icon"` kullan.
- Uzun içerikli kaydırma alanlarına `scroll-area fade-bottom` ver; kaydırma çubuğu yalnızca üzerine gelince görünür.
- Hareket `motion` ile; Ayarlar'daki "Hareketi azalt" ve Windows tercihi tüm geçişleri kapatır.

## Önizleme modu

Bağlanmadan tasarımı görmek için. Üstte sürekli "Önizleme modu" uyarısı durur, veriler `src/data/preview.ts`'deki örnek kişilerle (`ornek.sorvia.net`) gelir ve gerçek veriyle hiç karışmaz; bağlanınca önbellek tamamen temizlenir.
