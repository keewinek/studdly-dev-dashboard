'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"flutter_bootstrap.js": "8f861850b49af06b3711f644720905af",
"book_small.b64": "e14cae32d3e789e05c879814a0e39efb",
"version.json": "d9ade0ae0f449c2e6190dd2b48f7f285",
"index.html": "a6ff16f994d0bba6cc58bede82f1956b",
"/": "a6ff16f994d0bba6cc58bede82f1956b",
"main.dart.js": "acb5fe866929b8191471f2770a3384c8",
"flutter.js": "888483df48293866f9f41d3d9274a779",
"book_small.jpg": "649d793da94c5eba2a57c6d58c1806a9",
"favicon.png": "b4d7342d3f57de0ad3030e44c47b6670",
"icons/Icon-192.png": "1a514e36600bf4c95bde18d57ea43798",
"icons/Icon-maskable-192.png": "1a514e36600bf4c95bde18d57ea43798",
"icons/Icon-maskable-512.png": "2ba471f72782ed42a6839e5bccc1a106",
"icons/Icon-512.png": "2ba471f72782ed42a6839e5bccc1a106",
"manifest.json": "000c67f09b82e09f210ef1991784b394",
"book_page.jpg": "6ec3827c1e3552eb84d5921b4796aac6",
"assets/AssetManifest.json": "7cece97ae6dd727148a447bd6974bb13",
"assets/NOTICES": "405f56fbd4b478e7e1582a0d7a742f97",
"assets/FontManifest.json": "f49d2a9b857903b27e031c3c70b1d8da",
"assets/AssetManifest.bin.json": "cc6589a8645150b0c40f052b6b6faf61",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "33b7d9392238c04c131b6ce224e13711",
"assets/packages/font_awesome_flutter/lib/fonts/Font-Awesome-7-Free-Regular-400.otf": "c276cf5afd912b4d19f0ba02f83cf81e",
"assets/packages/font_awesome_flutter/lib/fonts/Font-Awesome-7-Brands-Regular-400.otf": "92092f979aa3c7b5ee861d57f673696c",
"assets/packages/font_awesome_flutter/lib/fonts/Font-Awesome-7-Free-Solid-900.otf": "e0b07b46c2c4c42293a66f628cd2b9a5",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/light/squiggly.png": "9894ce549037670d25d2c786036b810b",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/light/strikethrough.png": "26f6729eee851adb4b598e3470e73983",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/light/highlight.png": "2fbda47037f7c99871891ca5e57e030b",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/light/underline.png": "a98ff6a28215341f764f96d627a5d0f5",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/dark/squiggly.png": "68960bf4e16479abb83841e54e1ae6f4",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/dark/strikethrough.png": "72e2d23b4cdd8a9e5e9cadadf0f05a3f",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/dark/highlight.png": "2aecc31aaa39ad43c978f209962a985c",
"assets/packages/syncfusion_flutter_pdfviewer/assets/icons/dark/underline.png": "59886133294dd6587b0beeac054b2ca3",
"assets/packages/syncfusion_flutter_pdfviewer/assets/fonts/RobotoMono-Regular.ttf": "5b04fdfec4c8c36e8ca574e40b7148bb",
"assets/packages/fluttertoast/assets/toastify.js": "56e2c9cedd97f10e7e5f1cebd85d53e3",
"assets/packages/fluttertoast/assets/toastify.css": "a85675050054f179444bc5ad70ffc635",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/lib/core/config/translations/de.json": "9cfda6eaed3b789d3955426bbc78f3f6",
"assets/lib/core/config/translations/pl.json": "e14f1e82b3c0d9965634b834346ceb0a",
"assets/lib/core/config/translations/uk.json": "89a65a8209d4adc874af8db43392e841",
"assets/lib/core/config/translations/en.json": "056cee239dea5be85b0eb32835fa6fda",
"assets/lib/core/config/translations/fr.json": "d2ced139372ff2ba5f95790821e08c76",
"assets/lib/core/config/translations/es.json": "6edbedb87d71156f76f4eae5988a191c",
"assets/AssetManifest.bin": "affc9863e8553fd50b753dd3a411c21b",
"assets/fonts/MaterialIcons-Regular.otf": "5fd37e8c0f2008f969d32878fb2af19e",
"assets/assets/images/ukraine_flag.svg": "3cd846bfed9b9452b2c0179568d492a0",
"assets/assets/images/spain_flag.svg": "b6542d254d7f847d570a1ecc6e366458",
"assets/assets/images/StuddlyLogo_black.png": "a60009ab0546bf72e36dcc79a78b4b38",
"assets/assets/images/germany_flag.svg": "258e5f1431e73de0d2396b5f0702da52",
"assets/assets/images/uk_flag.svg": "939e0085876483b98a92187710d6c7c1",
"assets/assets/images/StuddlyLogo.png": "5cd3cedf5d359dfc2d871e5e26521f3b",
"assets/assets/images/zbita_lupa_black_icon.png": "753ae7d6c9b0fa65f3fe7a3fc7f37df2",
"assets/assets/images/logotype_white.png": "3f250e28dd89e96b67011cad092895af",
"assets/assets/images/zbita_lupa_icon.png": "c9b96ec5bb6149cc46ce2a8efd347d42",
"assets/assets/images/poland_flag.svg": "583a488fd5f852e185b5ad46ff772cc0",
"assets/assets/images/france_flag.svg": "1bc30c6a3dcec3611a0d5d6d8e1e2047",
"assets/assets/images/sloth_circle_overlay.png": "9216cdb1c1183eea271b92a0b7de9b04",
"assets/assets/images/studdly_standing.png": "994ba0b747917545c941e68201ec0b79",
"assets/assets/images/logotype_black.png": "0f2a6ce0060de560bda6ff14daf38a8a",
"assets/assets/images/logotype_dev.png": "dde1f3d27cbee65587b612193de8184a",
"assets/assets/sounds/StuddlyWrong.mp3": "85ff0c455c7733dff195941b90b0d65f",
"assets/assets/sounds/StuddlyCorrect.mp3": "337765d18c8b04bb129fe65a063713a2",
"assets/assets/videos/GoogleAIStudio.mp4": "445fefb93dbe6a7d38b5c20438fa9d0f",
"assets/assets/videos/OpenRouter.mp4": "2c8a82d6a7c8653486d89522be30cc75",
"assets/assets/videos/CerebrasCloud.mp4": "7c626ae811b6ad55b590af9db8b01800",
"assets/assets/videos/Groq.mp4": "11fb0f80294e82f7a63ae912c5e05088",
"assets/assets/videos/OpenAI.mp4": "7b5123cc70ec24db87580a246dd28952",
"assets/assets/icons/settings_icon.svg": "d85fc437bec35cf7d67dfbfd739164ac",
"assets/assets/prompts/page_analysys_exact_en.md": "3173f65539b2d243eca863ffe2a9c1d2",
"assets/assets/prompts/page_analysys_exact_uk.md": "70bb80abf0878769d6580ca375806c38",
"assets/assets/prompts/page_analysys_exact_fr.md": "49ba4bdceb713b2d5fa09944f8265f99",
"assets/assets/prompts/page_analysys_normal_es.md": "6df7f480a40043c0f9bfdb3ebccedd50",
"assets/assets/prompts/page_analysys_exact_es.md": "c35640fd77b6421635ab3ad1b97b1dd6",
"assets/assets/prompts/page_analysys_normal_en.md": "cae9d4018c5df13b391ccbaa02e3e182",
"assets/assets/prompts/page_analysys_normal_uk.md": "8553bcb49f21f113f290962a188425a5",
"assets/assets/prompts/page_analysys_normal_fr.md": "a181a2c0841892c9c76267c09543dba9",
"assets/assets/prompts/page_analysys_normal_de.md": "bc40a124ac44eb322a5e81aedb7e5255",
"assets/assets/prompts/page_analysys_fast_pl.md": "8873d85f9d4bd0f1fdfbb01302230ee7",
"assets/assets/prompts/page_analysys_exact_de.md": "b0ab45832a45c39186e83da95ce0b670",
"assets/assets/prompts/page_analysys_fast_es.md": "c1582e0c3d3cae84b32cd0cb47fa6aa7",
"assets/assets/prompts/page_analysys_fast_fr.md": "8dfe46997959545e8b67637107b40fa1",
"assets/assets/prompts/page_analysys_fast_uk.md": "2fcb8b4e4a4c79c4e5bbbff0b52e3007",
"assets/assets/prompts/page_analysys_fast_en.md": "f726cea3d4374bc320f902ce5f13ebb0",
"assets/assets/prompts/page_analysys_fast_de.md": "6b8b4f57c313a28dc52edc0a026d40fd",
"assets/assets/prompts/page_analysys_exact_pl.md": "48027275a046df6a5d7f1e1a59bfd9c2",
"assets/assets/prompts/page_analysys_normal_pl.md": "0127640acca566bbd7f378ba661afd2a",
"assets/assets/fonts/Figtree-VariableFont_wght.ttf": "1bb7463418dcef887a0ca4446186d066",
"assets/assets/fonts/README.md": "824017941b42514496115f4f9c3a4d23",
"assets/assets/fonts/Jost-VariableFont_wght.ttf": "ab7f34a1f4c65b7bdc16dba6beca3fa3",
"assets/assets/fonts/Quicksand-VariableFont_wght.ttf": "eb9ba45f2351c34b9aba487db9ce5762",
"canvaskit/skwasm.js": "1ef3ea3a0fec4569e5d531da25f34095",
"canvaskit/skwasm_heavy.js": "413f5b2b2d9345f37de148e2544f584f",
"canvaskit/skwasm.js.symbols": "0088242d10d7e7d6d2649d1fe1bda7c1",
"canvaskit/canvaskit.js.symbols": "58832fbed59e00d2190aa295c4d70360",
"canvaskit/skwasm_heavy.js.symbols": "3c01ec03b5de6d62c34e17014d1decd3",
"canvaskit/skwasm.wasm": "264db41426307cfc7fa44b95a7772109",
"canvaskit/chromium/canvaskit.js.symbols": "193deaca1a1424049326d4a91ad1d88d",
"canvaskit/chromium/canvaskit.js": "5e27aae346eee469027c80af0751d53d",
"canvaskit/chromium/canvaskit.wasm": "24c77e750a7fa6d474198905249ff506",
"canvaskit/canvaskit.js": "140ccb7d34d0a55065fbd422b843add6",
"canvaskit/canvaskit.wasm": "07b9f5853202304d3b0749d9306573cc",
"canvaskit/skwasm_heavy.wasm": "8034ad26ba2485dab2fd49bdd786837b"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
