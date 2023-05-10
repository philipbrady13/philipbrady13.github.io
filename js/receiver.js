const context = cast.framework.CastReceiverContext.getInstance()
const playerManager = context.getPlayerManager()

let customData = null

const playbackConfig = new cast.framework.PlaybackConfig()

function transformRequestInfo(requestInfo) {
  console.log('transformRequestInfo', requestInfo);
  if (!requestInfo.url.includes('Policy=')) {
    requestInfo.url = signUrl(requestInfo.url);
  }

  return requestInfo;
}

function signUrl(url) {
  var appendQueryString = customData ? customData.appendQueryString : null;
  var playback = customData ? customData.playback : null;

  if (appendQueryString) {
    return appendQs(url, appendQueryString);
  }
  else if (playback) {
    return signUrlUsingPlayback(url, playback);
  }

  return url;
}

function signUrlUsingPlayback(url, playback) {
  if (!playback) {
    return url;
  }

  const currentItem = getCurrentPlaybackItem(playback, url);
  if (!currentItem?.cloudfrontSignedCookie) {
    return url;
  }

  const qs = cloudfrontSignedCookieToQueryString(currentItem.cloudfrontSignedCookie);

  return appendQs(url, qs);
}

function getCurrentPlaybackItem(playback, url) {
  return playback.items.find(item => item.baseUrl && url.startsWith(item.baseUrl));
}

function cloudfrontSignedCookieToQueryString(cookie) {
  return `${cookie.policy ? `Policy=${encodeURIComponent(cookie.policy)}&` : ''}` +
    `Signature=${encodeURIComponent(cookie.signature)}&` +
    `${cookie.expires ? `Expires=${encodeURIComponent(cookie.expires)}&` : ''}` +
    `Key-Pair-Id=${encodeURIComponent(cookie.keyPairId)}`;
}

function appendQs(url, qs) {
  if (!qs) {
    return url;
  }

  return url + (url.includes('?') ? '&' : '?') + qs;
}

playbackConfig.manifestRequestHandler = (requestInfo) => {
  return transformRequestInfo(requestInfo)
};

playbackConfig.segmentHandler = segmentInfo => {
  return segmentInfo
};

playbackConfig.segmentRequestHandler = requestInfo => {
  return transformRequestInfo(requestInfo)
};

playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.LOAD,
  async request => {
    castDebugLogger.info('MyAPP.LOG', 'intercepting request: ', request);

    if (request.media) {
      customData = request.media.customData
    }

    // if(request.media.contentType == 'video/mp4') {
    if (![
      'application/x-mpegURL',
      'application/x-mpegurl'
    ].includes(request.media.contentType)) {
      castDebugLogger.warn('MyAPP.LOG', 'request.media.contentType !== application/x-mpegurl', request.media);
    }
    else {
      request.media.hlsSegmentFormat = cast.framework.messages.HlsSegmentFormat.FMP4;
      request.media.hlsVideoSegmentFormat = cast.framework.messages.HlsVideoSegmentFormat.FMP4;
    }

    return request
  }
);

/** Debug Logger **/
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
console.log('castDebugLogger', castDebugLogger);

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
