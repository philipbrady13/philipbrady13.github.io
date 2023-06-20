console.log('TEST ===')
const context = cast.framework.CastReceiverContext.getInstance()
const playerManager = context.getPlayerManager()

let customData = null

const playbackConfig = new cast.framework.PlaybackConfig()

function transformRequestInfo(requestInfo) {
  if (!requestInfo.url.includes('Policy=')) {
    requestInfo.url = signUrl(requestInfo.url)
  }

  return requestInfo
}

function signUrl(url) {
  var appendQueryString = customData ? customData.appendQueryString : null
  var playback = customData ? customData.playback : null

  if (appendQueryString) {
    return appendQs(url, appendQueryString)
  }
  else if (playback) {
    return signUrlUsingPlayback(url, playback)
  }

  return url
}

function signUrlUsingPlayback(url, playback) {
  if (!playback) {
    return url
  }

  const currentItem = getCurrentPlaybackItem(playback, url)
  if (!currentItem?.cloudfrontSignedCookie) {
    return url
  }

  const qs = cloudfrontSignedCookieToQueryString(currentItem.cloudfrontSignedCookie)

  return appendQs(url, qs)
}

function getCurrentPlaybackItem(playback, url) {
  return playback.items.find(item => item.baseUrl && url.startsWith(item.baseUrl))
}

function cloudfrontSignedCookieToQueryString(cookie) {
  return `${cookie.policy ? `Policy=${encodeURIComponent(cookie.policy)}&` : ''}` +
    `Signature=${encodeURIComponent(cookie.signature)}&` +
    `${cookie.expires ? `Expires=${encodeURIComponent(cookie.expires)}&` : ''}` +
    `Key-Pair-Id=${encodeURIComponent(cookie.keyPairId)}`
}

function appendQs(url, qs) {
  if (!qs) {
    return url
  }

  return url + (url.includes('?') ? '&' : '?') + qs
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


// NEW
const LOG_TAG = 'MyAPP.LOG';

// Enable debug logger and show a 'DEBUG MODE' overlay at top left corner.
context.addEventListener(cast.framework.system.EventType.READY, () => {
  if (!castDebugLogger.debugOverlayElement_) {
      castDebugLogger.setEnabled(true);
  }
});
// DONE


// Enable debug logger and show a warning on receiver
// NOTE: make sure it is disabled on production
// castDebugLogger.setEnabled(true);

// // Show debug overlay
// castDebugLogger.showDebugLogs(true);

playerManager.addEventListener(
  cast.framework.events.category.CORE,
  event => {
      castDebugLogger.info('ANALYTICS', 'CORE EVENT:', event);
});

// Set verbosity level for custom tags
castDebugLogger.loggerLevelByTags = {
  // 'MyAPP.LOG': cast.framework.LoggerLevel.WARNING,
  // 'ANALYTICS': cast.framework.LoggerLevel.INFO,
  'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
  'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG,


};

/** Optimizing for smart displays **/
const playerData = new cast.framework.ui.PlayerData();
const playerDataBinder = new cast.framework.ui.PlayerDataBinder(playerData);
const touchControls = cast.framework.ui.Controls.getInstance();

context.start({
  maxInactivity: 36000,
  playbackConfig: playbackConfig,
});
