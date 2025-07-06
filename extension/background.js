const requestMap = new Map();

chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    const headers = {};
    details.requestHeaders.forEach(h => {
      headers[h.name.toLowerCase()] = h.value;
    });

    requestMap.set(details.requestId, {
      url: details.url,
      time: new Date().toISOString(),
      headers,
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    const matched = requestMap.get(details.requestId);
    if (!matched) return;

    const resHeaders = {};
    details.responseHeaders.forEach(h => {
      resHeaders[h.name.toLowerCase()] = h.value;
    });

    const contentType = resHeaders["content-type"] || "";
    const disposition = resHeaders["content-disposition"] || "";

    const isDownloadable =
      // disposition.includes("attachment") ||
      /\.(zip|rar|pdf|mp4|mp3|7z|exe|iso|ts|m3u8)$/i.test(matched.url) || 
      /(video|audio|mpegurl|x-mpegurl|vnd\.apple\.mpegurl)/i.test(contentType);

    const isSegmentedFile = /[\._\-](seg|frag|chunk|part|ts|m4s)[\._\-]?\d{0,5}/i.test(matched.url);

    if (isDownloadable && !isSegmentedFile) {
      const result = {
        url: matched.url,
        contentType,
        disposition,
        time: matched.time,
        headers: matched.headers,
      };

      // console.log("Detected downloadable:", result);

      try {
        fetch("http://localhost:12345/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result)
        });
      } catch (err) {}

    }

    requestMap.delete(details.requestId);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);
