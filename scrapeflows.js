function createCORSRequest(method, url) {
    var xhr = new XMLHttpRequest();
    if ("withCredentials" in xhr) { 
        xhr.open(method, url, false);
    } else if (typeof XDomainRequest!="undefined") {
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        xhr = null;
    }
    return xhr;
}

function httpResponse(logtext) {
    console.log(logtext);
}

function httpGet(theURL) {
    var request = createCORSRequest('GET', theURL);
    request.send();
    return request.responseText;
}

function buildRequest(state) {
    // Builds request URL for a given state
    var pathBegin = 'http://waterservices.usgs.gov/nwis/iv/?stateCd=';
    var pathEnd = '&format=json';
    var path = pathBegin + state + pathEnd;
    return path;
}

var states = ['AL'];

function addpoints(data) {
    var jsonified = JSON.parse(data);
    timeSeries = jsonified.value.timeSeries;
    var geoJSON = {};
    geoJSON['type'] = 'FeatureCollection';
    geoJSON['features'] = [];
    for (var i in timeSeries) {
        station = timeSeries[i]
        var name = station.name;
        var lat = station.sourceInfo.geoLocation.geogLocation.latitude;
        var lon = station.sourceInfo.geoLocation.geogLocation.longitude;
        var feature = {};
        feature['type'] = 'Feature';
        feature['geometry'] = {};
        feature.geometry['type'] = 'Point';
        feature.geometry['coordinates'] = [lon, lat];
        feature['properties'] = {};
        feature.properties['name'] = name;
        geoJSON.features.push(feature);
        addpoint(lat, lon, name);
    //var stations = new L.geoJson(geoJSON, {
    //    onEachFeature: function(feature, layer) {
    //        layer.bindPopup(feature.properties.name);
    //    }});
    //map.addLayer(stations);
    }
}

function getFlows(states) {
    for (var i = 0; i < states.length; i++) {
        var result = httpGet(buildRequest(states[i]));
        console.log(states[i] + ' - data received.');
        addpoints(result);
    }
}
