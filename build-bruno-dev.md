# Build `Bruno-dev.app` vào /Applications

Đóng gói source hiện tại thành app chạy độc lập tên **`Bruno-dev`**, nằm trong `/Applications` cạnh bản Bruno thật. Không ký, không notarize, chỉ arm64, để test local. Mọi lệnh chạy từ **thư mục gốc repo** trừ khi ghi rõ khác.

Lưu ý: mặc định khi build dev là build .app, và cho vào Applications ghi đè lên Bruno-dev đang có, không build .dmg trừ khi yêu cầu. Tắt Bruno và Bruno-dev đang chạy nếu đang chạy.

## 1. Yêu cầu trước

Bắt buộc dùng đúng Node của `.nvmrc` (22.12.0). Sai version sẽ làm build tưởng như treo: rollup spam hàng nghìn lỗi TS từ `@faker-js/faker` rồi timeout.

```bash
# Chưa có nvm: https://github.com/nvm-sh/nvm#installing-and-updating
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install && nvm alias default 22.12.0
nvm use            # phải in ra v22.12.0
npm i --legacy-peer-deps
npm run setup
```

## 2. Build shared packages + renderer

`npm run dev` không build các package này, thiếu thì app đóng gói sẽ crash. Chạy lại sau mỗi lần sửa chúng. **Thứ tự quan trọng** — `bruno-filestore` phụ thuộc `@usebruno/schema-types`, build sai thứ tự sẽ fail ~25 lỗi `TS2307: Cannot find module '@usebruno/schema-types/collection/item'`. Đây cũng là thứ tự trong `scripts/setup.js`.

Lưu ý: nếu code không sửa thì không cần build lại

```bash
npm run build:schema-types && npm run build:graphql-docs && npm run build:bruno-common && npm run build:bruno-requests && npm run build:bruno-filestore && npm run build:bruno-sqlite && npm run build:bruno-converters && npm run build:bruno-query
npm run build:web      # renderer → packages/bruno-app/dist/
```

**Bắt buộc thêm** — bundle thư viện cho QuickJS sandbox. Thiếu bước này app đã đóng gói vẫn crash lúc mở với `Cannot find module '../bundle-browser-rollup'`. Sinh ra `packages/bruno-js/src/sandbox/bundle-browser-rollup.js` (~390 KB); file này không có trong git vì `@usebruno/js` được ship từ `src/` chứ không phải `dist/`.

```bash
npm run sandbox:bundle-libraries --workspace=packages/bruno-js
```

## 3. Config đóng gói riêng cho dev

`packages/bruno-electron/electron-builder-dev.js` — spread config chính rồi override:

```js
const base = require('./electron-builder-config');
module.exports = {
  ...base,
  appId: 'com.usebruno.app.dev',        // không đụng bundle id bản thật
  productName: 'Bruno-dev',             // tên file trong /Applications
  afterSign: null,                      // bỏ notarize, không cần APPLE_ID
  directories: { ...base.directories, output: 'out-dev' },
  mac: { ...base.mac, target: [{ target: 'dir', arch: ['arm64'] }], identity: null,
    notarize: false, protocols: [] }    // identity: không cần cert · protocols: không cướp bruno:// của bản thật
};
```

Không dùng `npm run build:electron` cho bản dev — script đó gọi `dist:mac` với config chính (có signing + notarize) nên fail khi thiếu certificate.

## 4. Đưa renderer vào package electron

Main process load `__dirname/../web/index.html`, asset phải là đường dẫn tương đối. Ba lệnh dưới làm đúng những gì `scripts/build-electron.js` làm (copy + sửa path + xoá sourcemap).

```bash
cd packages/bruno-electron
rm -rf web out-dev && mkdir -p web && cp -R ../bruno-app/dist/. web/
node -e "
const fs=require('fs'),p=require('path');
const fix=(fp,r,to)=>fs.writeFileSync(fp,fs.readFileSync(fp,'utf8').split(r).join(to));
fs.readdirSync('web').filter(f=>f.endsWith('.html')).forEach(f=>fix(p.join('web',f),/\/static/g,'./static'));
fs.readdirSync('web/static/css').filter(f=>f.endsWith('.css')).forEach(f=>fix(p.join('web/static/css',f),/\/static\/font/g,'../../static/font'));"
find web -name '*.map' -delete
```

## 5. Đóng gói và cài

```bash
npx electron-builder --mac --arm64 --dir --config electron-builder-dev.js   # chỉ .app
npx electron-builder --mac --arm64 --config electron-builder-dev.js         # .app + .dmg
cd ../..
rm -rf /Applications/Bruno-dev.app
ditto packages/bruno-electron/out-dev/mac-arm64/Bruno-dev.app /Applications/Bruno-dev.app
/Applications/Bruno-dev.app/Contents/MacOS/Bruno-dev
```

Không có flag `--dmg` — muốn DMG thì bỏ cờ target, vì `mac.target` trong config đã khai báo sẵn cả `dir` lẫn `dmg`. DMG ra `out-dev/bruno_<version>_arm64_mac.dmg` (~144 MB, tên file lấy từ `name` trong `package.json` nên là `bruno` chứ không phải `Bruno-dev`). Đóng gói khoảng 1 phút sau lần tải Electron đầu. Log bình thường kết thúc bằng `• skipped macOS code signing  reason=identity explicitly is set to null`; có thể kèm lỗi `GitHub Personal Access Token is not set` ở bước publish — vô hại, artifact đã tạo xong. Dùng `ditto` thay vì `cp -R` để giữ đúng quyền và symlink. Chạy binary trực tiếp thay vì `open` — `open` không in log main process ra terminal.

**Dấu hiệu chạy đúng:** có 3 helper process đi kèm (`ps -Ao pid,comm | grep -i bruno` → `Bruno-dev` + 3 `Bruno-dev Helper`) và log in dòng `watcher add: ...` cho từng collection. Chỉ có process chính mà không có helper nào nghĩa là renderer đã chết.

DMG **không ký**, nên máy khác mở sẽ bị Gatekeeper chặn. Người dùng phải click chuột phải → Open lần đầu, hoặc `xattr -dr com.apple.quarantine /Applications/Bruno-dev.app` sau khi copy.

## Lưu ý: userData dùng chung

Bản `Bruno-dev` vẫn đọc/ghi `~/Library/Application Support/bruno` (preferences, `bruno.db`, scratch requests) — **giống hệt bản Bruno thật**, vì Electron lấy `userData` từ `name` trong `package.json` (`"bruno"`), không phải `productName`. **Đừng chạy cả hai cùng lúc** — cùng đụng `bruno.db`, và `requestSingleInstanceLock()` (`src/index.js:150`) khiến bản mở sau tự thoát.

**Không tách được bằng biến môi trường.** `ELECTRON_USER_DATA_PATH` không hoạt động trong bản packaged: `src/index.js:21` bọc nó trong `if (isDev && ...)` mà `isDev` là false. Muốn tách thật thì phải sửa code (bỏ điều kiện `isDev`, hoặc đổi `name` trong `packages/bruno-electron/package.json` rồi đóng gói lại).

## Build lại nhanh

Chỉ sửa code trong `bruno-app`: `npm run build:web` → lặp lại bước 4 → lặp lại bước 5. Đã sửa `bruno-js` hoặc shared packages thì phải chạy lại bước 2. Dọn dẹp: `rm -rf packages/bruno-electron/out-dev packages/bruno-electron/web`.

## Nếu app trắng hoặc crash

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `Cannot find module '../bundle-browser-rollup'` | Thiếu bước bundle QuickJS | `npm run sandbox:bundle-libraries --workspace=packages/bruno-js` rồi đóng gói lại |
| `TS2307: Cannot find module '@usebruno/schema-types/...'` | Sai thứ tự build | `schema-types` phải trước `bruno-filestore` |
| Spam lỗi TS từ `@faker-js/faker` rồi treo | Sai Node version | `nvm use` → phải là 22.12.0 |
| Màn hình trắng | Chưa copy renderer | `ls packages/bruno-app/dist/index.html`, làm lại bước 2 + 4 |
| ErrorBoundary → bấm "Return to app" báo `No handler registered for 'open-file'` rồi SIGABRT | Bug có sẵn ở `packages/bruno-app/src/pages/ErrorBoundary/index.js:30` | Không liên quan bản build, bỏ qua |
