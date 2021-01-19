const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();


const playbackConfig = new cast.framework.PlaybackConfig();
// Customize the license url for playback
// playbackConfig.licenseUrl = 'https://wv-keyos.licensekeyserver.com/';
// playbackConfig.protectionSystem = cast.framework.ContentProtection.WIDEVINE;
// playbackConfig.licenseRequestHandler = requestInfo => {
//   requestInfo.withCredentials = true;
//   requestInfo.headers = {
//     'customdata': '<custom data>'
//   };
// };

playbackConfig.manifestRequestHandler = requestInfo => {
  requestInfo.withCredentials = true;
};


// Update playback config licenseUrl according to provided value in load request.
context.getPlayerManager().setMediaPlaybackInfoHandler((loadRequest, playbackConfig) => {
  if (loadRequest.media.customData && loadRequest.media.customData.licenseUrl) {
    playbackConfig.licenseUrl = loadRequest.media.customData.licenseUrl;
  }
  return playbackConfig;
});


function makeRequest (method, url) {
  console.log('makeRequest()', method, url);
  return new Promise(async function (resolve, reject) {
    // var xhr = new XMLHttpRequest();
    // xhr.open(method, url);
    // xhr.onload = function () {
    //   console.log('xhr onload', this);
    //   if (this.status >= 200 && this.status < 300) {
    //     // resolve(xhr.response.text());
    //     // resolve(JSON.stringify(xhr.response));
    //     resolve(xhr.response);
    //   } else {
    //     reject({
    //       status: this.status,
    //       statusText: xhr.statusText
    //     });
    //   }
    // };
    // xhr.onerror = function () {
    //   console.log('xhr error', this);
    //   reject({
    //     status: this.status,
    //     statusText: xhr.statusText
    //   });
    // };
    // xhr.send();

    const response = await fetch(url, {
      method,
    });

    console.log('z: ', response);

    return response;
  });
}

playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.LOAD,
  request => {
    console.log('intercepting request: ', request);

    if (request.media && request.media.entity) {
      request.media.contentId = request.media.entity;
    }

    return new Promise((resolve, reject) => {
      // if(request.media.contentType == 'video/mp4') {
      if (![
        'application/x-mpegURL',
        'application/x-mpegurl'
      ].includes(request.media.contentType)) {
        console.warn('MyAPP.LOG', 'request.media.contentType !== application/x-mpegurl', request.media);
        return resolve(request);
      }

      var mediaUrl = request.media.contentId;
      var appendQueryString = request.media.customData ? request.media.customData.appendQueryString : null;
      var signedMediaUrl = !!appendQueryString ? mediaUrl + '?' + appendQueryString : mediaUrl;

      console.log('appendQueryString, signedMediaUrl :: ', appendQueryString, signedMediaUrl);

      // Fetch content repository by requested contentId
      makeRequest('GET', signedMediaUrl)
        .then(function (data) {
          console.log('make request ...then ... data: ', data)
          var item = signedMediaUrl;

          if(!item) {
            // Content could not be found in repository
            castDebugLogger.error('MyAPP.LOG', 'Content not found');
            reject();
          } else {
            // Adjusting request to make requested content playable
            request.media.contentId = signedMediaUrl;
            request.media.contentType = 'application/x-mpegurl';
            request.media.hlsSegmentFormat = cast.framework.messages.HlsSegmentFormat.TS;
            request.media.hlsVideoSegmentFormat = cast.framework.messages.HlsVideoSegmentFormat.FMP4;

            // Add metadata
            var metadata = new cast.framework.messages.MovieMediaMetadata();
            metadata.metadataType = cast.framework.messages.MetadataType.MOVIE;
            metadata.title = item.title;
            metadata.subtitle = item.author;

            request.media.metadata = metadata;

            console.log('final request::', request);

            resolve(request);
          }
      });
    });
  });

/** Debug Logger **/
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();

// Enable debug logger and show a warning on receiver
// NOTE: make sure it is disabled on production
castDebugLogger.setEnabled(true);

// Show debug overlay
// castDebugLogger.showDebugLogs(true);

playerManager.addEventListener(
  cast.framework.events.category.CORE,
  event => {
      castDebugLogger.info('ANALYTICS', 'CORE EVENT:', event);
});

// Set verbosity level for custom tags
castDebugLogger.loggerLevelByTags = {
  'MyAPP.LOG': cast.framework.LoggerLevel.WARNING,
  'ANALYTICS': cast.framework.LoggerLevel.INFO,
};

/** Optimizing for smart displays **/
const playerData = new cast.framework.ui.PlayerData();
const playerDataBinder = new cast.framework.ui.PlayerDataBinder(playerData);
const touchControls = cast.framework.ui.Controls.getInstance();

let browseItems = getBrwoseItems();

function getBrwoseItems() {
  let data = '"video": { \
    "author": "The Blender Project", \
    "description": "Grumpy Bunny is grumpy", \
    "poster": "https://storage.googleapis.com/tse-summit.appspot.com/bbb/poster.png", \
    "prog": "https://storage.googleapis.com/tse-summit.appspot.com/bbb/bbb-prog.mp4", \
    "stream": { \
      "dash": "https://d8dbsji255dut.cloudfront.net/drm-test/4K-Gaming-Sample.mpd", \
      "hls": "https://d8dbsji255dut.cloudfront.net/drm-test/4K-Gaming-Sample.m3u8" \
    }, \
    "title": "Big Buck Bunny" \
  }';


  let browseItems = [];

  for (let key in data) {
    let item = new cast.framework.ui.BrowseItem();
    item.entity = key;
    item.title = data[key].title;
    item.subtitle = data[key].description;
    item.image = new cast.framework.messages.Image(data[key].poster);
    item.imageType = cast.framework.ui.BrowseImageType.MOVIE;
    browseItems.push(item);
  }
  return browseItems;
}

let browseContent = new cast.framework.ui.BrowseContent();
browseContent.title = 'Up Next';
browseContent.items = browseItems;
browseContent.targetAspectRatio =
  cast.framework.ui.BrowseImageAspectRatio.LANDSCAPE_16_TO_9;

playerDataBinder.addEventListener(
  cast.framework.ui.PlayerDataEventType.MEDIA_CHANGED,
  (e) => {
    if (!e.value) return;

    // Clear default buttons and re-assign
    touchControls.clearDefaultSlotAssignments();
    touchControls.assignButton(
      cast.framework.ui.ControlsSlot.SLOT_1,
      cast.framework.ui.ControlsButton.SEEK_BACKWARD_30
    );

    // Media browse
    touchControls.setBrowseContent(browseContent);
  });

// context.start({ touchScreenOptimizedApp: true });

context.start({
  maxInactivity: 36000,
  playbackConfig: playbackConfig,
});































// // const context = cast.framework.CastReceiverContext.getInstance();
// // const playerManager = context.getPlayerManager();

// // context.start();



// // https://codelabs.developers.google.com/codelabs/cast-receiver#1

// const context = cast.framework.CastReceiverContext.getInstance();
// const playerManager = context.getPlayerManager();

// //Media Sample API Values
// const SAMPLE_URL = "https://storage.googleapis.com/cpe-sample-media/content.json";
// const StreamType = {
//   DASH: 'application/dash+xml',
//   HLS: 'application/x-mpegurl'
// }
// const TEST_STREAM_TYPE = StreamType.DASH

// // Debug Logger
// const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
// const LOG_TAG = 'MyAPP.LOG';

// // Enable debug logger and show a 'DEBUG MODE' overlay at top left corner.
// castDebugLogger.setEnabled(true);

// // Show debug overlay
// castDebugLogger.showDebugLogs(true);

// // Set verbosity level for Core events.
// castDebugLogger.loggerLevelByEvents = {
//   'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
//   'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG
// }

// // Set verbosity level for custom tags.
// castDebugLogger.loggerLevelByTags = {
//     LOG_TAG: cast.framework.LoggerLevel.DEBUG,
// };

// function makeRequest (method, url) {
//   return new Promise(function async (resolve, reject) {
//     castDebugLogger.warn('makeRequest', method, url);
//     let xhr = new XMLHttpRequest();

//     castDebugLogger.warn('makeRequest opening');
//     xhr.open(method, url, false);

//     xhr.responseType = 'blob';

//     castDebugLogger.warn('makeRequest set onload');
//     xhr.onload = function () {
//       castDebugLogger.warn('makeRequest onload', this.status);
//       if (this.status >= 200 && this.status < 300) {
//         resolve(JSON.parse(xhr.response));
//       } else {
//         reject({
//           status: this.status,
//           statusText: xhr.statusText,
//           when: 'onload'
//         });
//       }
//     };

//     castDebugLogger.warn('makeRequest set onerror');
//     xhr.onerror = function (err) {
//       castDebugLogger.error('xhr.onerror', err);
//       reject({
//         status: this.status,
//         statusText: xhr.statusText,
//         when: 'onerror'
//       });
//     };

//     castDebugLogger.warn('makeRequest send');
//     xhr.send();

//     // try {
//     //   const response = await fetch(url, {
//     //     method,
//     //     mode: 'cors',
//     //   });

//     //   return resolve(response.json());
//     // } catch (err) {
//     //   castDebugLogger.error('xhr.onerror', err);
//     //   reject({
//     //     status: 400
//     //   });
//     // }
//   });
// }

// playerManager.setMessageInterceptor(
//   cast.framework.messages.MessageType.LOAD,
//   request => {
//     castDebugLogger.info(LOG_TAG, 'Intercepting LOAD request', request);

//     // Map contentId to entity
//     if (request.media && request.media.entity) {
//       request.media.contentId = request.media.entity;
//     }

//     return new Promise((resolve, reject) => {
//       // Fetch repository metadata
//       castDebugLogger.info(LOG_TAG, 'making GET request to ', request.media.contentId);

//       makeRequest('GET', request.media.contentId)
//         .then(function (data) {
//           castDebugLogger.warn('PHIL::', request.media, data);
//           // Obtain resources by contentId from downloaded repository metadata.
//           // let item = data[request.media.contentId];
//           let item = data;

//           if(!item) {
//             // Content could not be found in repository
//             castDebugLogger.error(LOG_TAG, 'Content not found');
//             reject();
//           } else {
//             // Adjusting request to make requested content playable
//             request.media.contentType = TEST_STREAM_TYPE;
//             request.media.contentType = request.media.contentType;

//             // Configure player to parse DASH content
//             if(request.media.contentType == StreamType.DASH) {
//               console.log('request.media.contentType == StreamType.DASH')
//               request.media.contentUrl = item.stream.dash;
//             }

//             // Configure player to parse HLS content
//             else if(request.media.contentType == StreamType.HLS) {
//               console.log('request.media.contentType == StreamType.HLS')
//               request.media.contentUrl = item.stream.hls
//               request.media.hlsSegmentFormat = cast.framework.messages.HlsSegmentFormat.FMP4;
//               request.media.hlsVideoSegmentFormat = cast.framework.messages.HlsVideoSegmentFormat.FMP4;
//             }

//             castDebugLogger.warn(LOG_TAG, 'Playable URL:', request.media.contentUrl);

//             // Add metadata
//             let metadata = new cast.framework.messages.GenericMediaMetadata();
//             metadata.title = item.title;
//             metadata.subtitle = item.author;

//             request.media.metadata = metadata;

//             // Resolve request
//             resolve(request);
//           }
//       }).catch(function (err) {
//         castDebugLogger.error(LOG_TAG, 'CATCH ERROR ON MAKEREQUEST', err);
//       });
//     });
//   });

// // Optimizing for smart displays
// // const touchControls = cast.framework.ui.Controls.getInstance();
// // const playerData = new cast.framework.ui.PlayerData();
// // const playerDataBinder = new cast.framework.ui.PlayerDataBinder(playerData);

// // let browseItems = getBrowseItems();

// // function getBrowseItems() {
// //   let browseItems = [];
// //   makeRequest('GET', SAMPLE_URL)
// //   .then(function (data) {
// //     for (let key in data) {
// //       let item = new cast.framework.ui.BrowseItem();
// //       item.entity = key;
// //       item.title = data[key].title;
// //       item.subtitle = data[key].description;
// //       item.image = new cast.framework.messages.Image(data[key].poster);
// //       item.imageType = cast.framework.ui.BrowseImageType.MOVIE;
// //       browseItems.push(item);
// //     }
// //   });
// //   return browseItems;
// // }

// // let browseContent = new cast.framework.ui.BrowseContent();
// // browseContent.title = 'Up Next';
// // browseContent.items = browseItems;
// // browseContent.targetAspectRatio =
// //   cast.framework.ui.BrowseImageAspectRatio.LANDSCAPE_16_TO_9;

// // playerDataBinder.addEventListener(
// //   cast.framework.ui.PlayerDataEventType.MEDIA_CHANGED,
// //   (e) => {
// //     if (!e.value) return;

// //     // Media browse
// //     touchControls.setBrowseContent(browseContent);

// //     // Clear default buttons and re-assign
// //     touchControls.clearDefaultSlotAssignments();
// //     touchControls.assignButton(
// //       cast.framework.ui.ControlsSlot.SLOT_PRIMARY_1,
// //       cast.framework.ui.ControlsButton.SEEK_BACKWARD_30
// //     );
// //   });


// const playbackConfig = new cast.framework.PlaybackConfig();
// playbackConfig.manifestRequestHandler = requestInfo => {
//   requestInfo.withCredentials = true;
// }

// context.start({playbackConfig: playbackConfig});
