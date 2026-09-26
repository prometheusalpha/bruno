# Build `Bruno-dev.app` vào /Applications

Hướng dẫn đóng gói source hiện tại thành một bản app chạy độc lập, tên **`Bruno-dev`**,
nằm trong `/Applications` cạnh bản Bruno thật.

Bản này **không ký, không notarize**, chỉ arm64, dùng để test local.

Mọi lệnh dưới đây đã chạy thật và sinh ra app tại `/Applications/Bruno-dev.app`.

---

## 1. Yêu cầu trước khi bắt đầu

```bash
nvm use          # Node 22.12.0, xem .nvmrc
npm i --legacy-peer-deps
npm run setup
```

Chạy tất cả lệnh từ **thư mục gốc repo** trừ khi ghi rõ khác.

---

## 2. Build shared packages

`npm run dev` không build các package dùng chung, nếu thiếu thì app đóng gói sẽ crash.
Bắt buộc chạy trước mỗi lần build nếu vừa sửa chúng:

```bash
npm run build:bruno-common
npm run build:bruno-requests
npm run build:bruno-filestore
npm run build:bruno-sqlite
npm run build:bruno-converters
npm run build:bruno-query
npm run build:graphql-docs
npm run build:schema-types
```

> Thay bằng `npm run watch:common`, `npm run watch:requests`, `npm run watch:converters`
> nếu anh đang sửa liên tục.

---

## 3. Build renderer

```bash
npm run build:web
```

Kết quả: `packages/bruno-app/dist/`

---

## 4. Config đóng gói riêng cho dev

Tạo file `packages/bruno-electron/electron-builder-dev.js`:

```js
// Dev packaging override for electron-builder.
//
// Produces a local `Bruno-dev.app` that can sit in /Applications next to a real
// Bruno install without clashing:
//   - distinct productName/appId → separate bundle id, separate userData folder
//   - no `protocols`            → does not steal the `bruno://` URL scheme
//   - identity: null, afterSign: null → no certificate / notarization needed
//
// Usage (from packages/bruno-electron):
//   npx electron-builder --mac --arm64 --dir --config electron-builder-dev.js

const base = require('./electron-builder-config');

module.exports = {
  ...base,
  appId: 'com.usebruno.app.dev',
  productName: 'Bruno-dev',
  afterSign: null,
  directories: {
    ...base.directories,
    output: 'out-dev'
  },
  mac: {
    ...base.mac,
    target: [{ target: 'dir', arch: ['arm64'] }],
    identity: null,
    notarize: false,
    // Omitted on purpose — see header.
    protocols: []
  }
};
```

Ba điểm khác biệt so với config chính:

| | Config chính | Config dev | Vì sao |
|---|---|---|---|
| `productName` | `Bruno` | `Bruno-dev` | tên file trong /Applications |
| `appId` | `com.usebruno.app` | `com.usebruno.app.dev` | không đụng bundle id của Bruno thật |
| `protocols` | đăng ký `bruno://` | rỗng | bản dev không cướp URL scheme của bản thật |
| `identity` | cert Anoop MD | `null` | không cần Apple Developer cert |
| `afterSign` | `notarize.js` | `null` | bỏ notarize, không cần `APPLE_ID` |

Không dùng `npm run build:electron` cho bản dev — script đó gọi `dist:mac` với config
chính (có signing + notarize) nên sẽ fail khi thiếu certificate.

---

## 5. Đưa renderer vào package electron

Main process load `__dirname/../web/index.html`, và asset phải là đường dẫn
tương đối. Hai bước dưới làm đúng những gì `scripts/build-electron.js` làm
(copy + sửa path + xoá sourcemap).

```bash
cd packages/bruno-electron

rm -rf web out-dev
mkdir -p web
cp -R ../bruno-app/dist/. web/

node -e "
const fs=require('fs'),p=require('path');
for (const f of fs.readdirSync('web')) {
  if (!f.endsWith('.html')) continue;
  const fp=p.join('web',f);
  fs.writeFileSync(fp, fs.readFileSync(fp,'utf8').replace(/\/static/g,'./static'));
}
const cssDir=p.join('web','static/css');
for (const f of fs.readdirSync(cssDir)) {
  if (!f.endsWith('.css')) continue;
  const fp=p.join(cssDir,f);
  fs.writeFileSync(fp, fs.readFileSync(fp,'utf8').replace(/\/static\/font/g,'../../static/font'));
}
"

find web -name '*.map' -delete
```

---

## 6. Đóng gói

```bash
npx electron-builder --mac --arm64 --dir --config electron-builder-dev.js
```

Kết quả: `packages/bruno-electron/out-dev/mac-arm64/Bruno-dev.app` (~434 MB)

Log bình thường kết thúc bằng:

```
• packaging       platform=darwin arch=arm64 electron=37.6.1 appOutDir=out-dev/mac-arm64
• skipped macOS code signing  reason=identity explicitly is set to null
```

---

## 7. Cài vào /Applications

```bash
cd ../..
rm -rf /Applications/Bruno-dev.app
ditto packages/bruno-electron/out-dev/mac-arm64/Bruno-dev.app /Applications/Bruno-dev.app
open -a /Applications/Bruno-dev.app
```

Dùng `ditto` thay vì `cp -R` để giữ đúng quyền và symlink.

Kiểm tra app đã mở:

```bash
ps aux | grep "[B]runo-dev.app/Contents/MacOS" | wc -l   # kỳ vọng: 1
```

---

## Lưu ý quan trọng: userData dùng chung

Bản `Bruno-dev` vẫn đọc/ghi `~/Library/Application Support/bruno`
(preferences, `bruno.db`, scratch requests) — **giống hệt bản Bruno thật**, vì
Electron lấy `userData` từ `name` trong `package.json` (`"bruno"`), không phải
từ `productName`.

Hai hệ quả:

- Mở cả hai cùng lúc sẽ đụng `bruno.db`. App có `requestSingleInstanceLock()`
  (`packages/bruno-electron/src/index.js:150`), nên bản mở sau sẽ tự thoát.
- Đóng gói lại với code đã sửa `bruno-app` thì không sao, nhưng **không nên** chạy
  bản dev cùng lúc với bản thật khi đang debug.

Muốn tách hoàn toàn, đặt biến môi trường khi mở app — `src/index.js:25` đã hỗ trợ
sẵn `ELECTRON_USER_DATA_PATH`:

```bash
ELECTRON_USER_DATA_PATH="$HOME/Library/Application Support/bruno-dev" \
  open -a /Applications/Bruno-dev.app
```

Lưu ý: `open` không truyền env xuống app đã cài. Muốn chắc chắn, chạy trực tiếp
binary:

```bash
ELECTRON_USER_DATA_PATH="$HOME/Library/Application Support/bruno-dev" \
  /Applications/Bruno-dev.app/Contents/MacOS/Bruno-dev
```

---

## Build lại nhanh

Lần sau chỉ sửa code trong `bruno-app`:

```bash
npm run build:web
cd packages/bruno-electron && rm -rf web out-dev && mkdir -p web && cp -R ../bruno-app/dist/. web/
# sửa path + xoá sourcemap như bước 5
npx electron-builder --mac --arm64 --dir --config electron-builder-dev.js
cd ../.. && rm -rf /Applications/Bruno-dev.app
ditto packages/bruno-electron/out-dev/mac-arm64/Bruno-dev.app /Applications/Bruno-dev.app
```

## Dọn dẹp

```bash
rm -rf packages/bruno-electron/out-dev packages/bruno-electron/web
```

## Nếu app mở ra trắng hoặc crash

1. Kiểm tra renderer đã build: `ls packages/bruno-app/dist/index.html`
2. Kiểm tra shared packages đã build: `ls packages/bruno-common/dist/index.d.ts`
3. Xem log main process:
   `/Applications/Bruno-dev.app/Contents/MacOS/Bruno-dev`
4. Crash ở tầng renderer sẽ hiện ErrorBoundary. Bấm **"Return to app"** sẽ báo
   `No handler registered for 'open-file'` rồi SIGABRT — đó là bug có sẵn trong
   `packages/bruno-app/src/pages/ErrorBoundary/index.js:30` (channel `open-file`
   không tồn tại trong main process), không liên quan tới bản build.
