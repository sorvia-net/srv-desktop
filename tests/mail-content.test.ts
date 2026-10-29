import assert from "node:assert/strict";
import { test } from "node:test";

import { addresses, cleanHtml, decodeText, decodeTransfer, EMAIL, previewText, safeName } from "../electron/mail-content.ts";

test("betik, olay, form ve iç çerçeve temizlenir", () => {
  const { html } = cleanHtml('<p onclick="x()">Merhaba</p><script>alert(1)</script><form action="https://kotu.example"><input></form><iframe src="https://kotu.example"></iframe><a href="javascript:alert(2)">tıkla</a>');
  assert.equal(/<script|onclick|<form|<iframe|<input|javascript:/i.test(html), false, html);
  assert.match(html, /<p>Merhaba<\/p>/);
});

test("bağlantılar yeni pencerede ve referanssız açılır", () => {
  const { html } = cleanHtml('<a href="https://sorvia.net/destek">Destek</a>');
  assert.match(html, /href="https:\/\/sorvia.net\/destek"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("dış görsel ve CSS arka planı dış içerik olarak işaretlenir", () => {
  assert.equal(cleanHtml('<img src="https://izleme.example/p.png">').remote, true);
  assert.equal(cleanHtml('<div style="background:url(https://izleme.example/a.png)">x</div>').remote, true);
  assert.equal(cleanHtml('<img src="data:image/png;base64,iVBORw0KGgo=">').remote, false);
  assert.equal(cleanHtml("<p>düz</p>").remote, false);
});

test("protokol göreli ve tehlikeli görsel adresleri düşer", () => {
  const { html } = cleanHtml('<img src="//izleme.example/p.png"><img src="file:///C:/gizli.png">');
  assert.equal(/izleme\.example|file:/.test(html), false, html);
});

test("quoted-printable ve base64 çözülür", () => {
  assert.equal(decodeText(decodeTransfer(Buffer.from("Merhaba =C3=A7al=C4=B1=C5=9Fma=\r\n arkada=C5=9F"), "quoted-printable"), "utf-8"), "Merhaba çalışma arkadaş");
  assert.equal(decodeText(decodeTransfer(Buffer.from(Buffer.from("Güncelleme hazır").toString("base64").slice(0, -1)), "base64"), "utf-8").startsWith("Güncelleme"), true);
  assert.equal(decodeText(Buffer.from([0x47, 0xfc, 0x6e]), "iso-8859-9"), "Gün");
});

test("önizleme alıntıları ve HTML'yi atar", () => {
  assert.equal(previewText("Teşekkürler\n> eski ileti\n> devamı\nGörüşürüz", false), "Teşekkürler Görüşürüz");
  assert.equal(previewText("<style>p{color:red}</style><p>Merhaba&nbsp;<b>ekip</b></p>", true), "Merhaba ekip");
  assert.equal(previewText("a".repeat(400), false).length, 180);
});

test("dosya adı Windows için güvenli hale gelir", () => {
  assert.equal(safeName('..\\rapor:2026?.pdf'), "_rapor_2026_.pdf");
  assert.equal(safeName("   "), "ek");
  assert.equal(safeName("a".repeat(300)).length, 150);
});

test("alıcı listesi ve adres doğrulama", () => {
  assert.deepEqual(addresses("Ece <ece@sorvia.net>, deniz@sorvia.net; ; destek@ornek.com"), ["ece@sorvia.net", "deniz@sorvia.net", "destek@ornek.com"]);
  assert.equal(EMAIL.test("deniz@sorvia.net"), true);
  assert.equal(EMAIL.test("deniz@sorvia"), false);
  assert.equal(EMAIL.test("deniz sorvia.net"), false);
  assert.equal(EMAIL.test("a@b.c\r\nBcc: x@y.z"), false);
});
