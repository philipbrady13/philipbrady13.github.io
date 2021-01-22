const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

let querySignature = null;

const playbackConfig = new cast.framework.PlaybackConfig();

playbackConfig.manifestRequestHandler = (requestInfo) => {
  requestInfo.withCredentials = true;
  console.log('manifestRequestHandler: ', requestInfo);

  if (!requestInfo.url.includes('?')) {
    requestInfo.url = requestInfo.url + '?' + querySignature
  }

  return requestInfo
};

playbackConfig.segmentHandler = segmentInfo => {
  console.log('segmentHandler: ', segmentInfo);

  return segmentInfo
};

playbackConfig.segmentRequestHandler = segmentInfo => {
  segmentInfo.withCredentials = true;
  console.log('segmentRequestHandler: ', segmentInfo);

  if (!segmentInfo.url.includes('?')) {
    segmentInfo.url = segmentInfo.url + '?' + querySignature
  }

  return segmentInfo
};


function makeRequest (method, url) {
  return new Promise(async function (resolve, reject) {
    const response = await fetch(url, {
      method,
    });

    const text = await response.text()

    resolve(text);
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

      querySignature = appendQueryString

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
            request.media.hlsSegmentFormat = cast.framework.messages.HlsSegmentFormat.FMP4;
            request.media.hlsVideoSegmentFormat = cast.framework.messages.HlsVideoSegmentFormat.FMP4;

            // Add metadata
            // var metadata = new cast.framework.messages.MovieMediaMetadata();
            // metadata.metadataType = cast.framework.messages.MetadataType.MOVIE;

            // metadata.title = item.title;
            // metadata.subtitle = item.author;

            // request.media.metadata = metadata;

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
castDebugLogger.setEnabled(false);

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

// let browseItems = getBrwoseItems();

// function getBrwoseItems() {
//   let data = '"video": { \
//     "author": "The Blender Project", \
//     "description": "Grumpy Bunny is grumpy", \
//     "poster": "https://storage.googleapis.com/tse-summit.appspot.com/bbb/poster.png", \
//     "prog": "https://storage.googleapis.com/tse-summit.appspot.com/bbb/bbb-prog.mp4", \
//     "stream": { \
//       "dash": "https://d8dbsji255dut.cloudfront.net/drm-test/4K-Gaming-Sample.mpd", \
//       "hls": "https://d8dbsji255dut.cloudfront.net/drm-test/4K-Gaming-Sample.m3u8" \
//     }, \
//     "title": "Big Buck Bunny" \
//   }';


//   let browseItems = [];

//   for (let key in data) {
//     let item = new cast.framework.ui.BrowseItem();
//     item.entity = key;
//     item.title = data[key].title;
//     item.subtitle = data[key].description;
//     item.image = new cast.framework.messages.Image(data[key].poster);
//     item.imageType = cast.framework.ui.BrowseImageType.MOVIE;
//     browseItems.push(item);
//   }
//   return browseItems;
// }

// let browseContent = new cast.framework.ui.BrowseContent();
// browseContent.title = 'Up Next';
// browseContent.items = browseItems;
// browseContent.targetAspectRatio =
//   cast.framework.ui.BrowseImageAspectRatio.LANDSCAPE_16_TO_9;

// playerDataBinder.addEventListener(
//   cast.framework.ui.PlayerDataEventType.MEDIA_CHANGED,
//   (e) => {
//     if (!e.value) return;

//     // Clear default buttons and re-assign
//     touchControls.clearDefaultSlotAssignments();
//     touchControls.assignButton(
//       cast.framework.ui.ControlsSlot.SLOT_1,
//       cast.framework.ui.ControlsButton.SEEK_BACKWARD_30
//     );

//     // Media browse
//     touchControls.setBrowseContent(browseContent);
//   });

// context.start({ touchScreenOptimizedApp: true });

context.start({
  maxInactivity: 36000,
  playbackConfig: playbackConfig,
});
