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

var states = ['VA'];

function extractStationData(rawUsgsData) {
    var jsonified = JSON.parse(rawUsgsData);
    timeSeries = jsonified.value.timeSeries;
    stationData = {};
    for (var i in timeSeries) {
        station = timeSeries[i];
        var siteName = station.sourceInfo.siteName;
        var siteNumber = station.sourceInfo.siteCode[0].value;
        var lat = station.sourceInfo.geoLocation.geogLocation.latitude;
        var lon = station.sourceInfo.geoLocation.geogLocation.longitude;
        var variable = station.variable.variableName;
        var value = station.values[0].value[0].value;
        if (!(siteNumber in stationData)) {
            stationData[siteNumber] = {'data':{}};
        }
        stationData[siteNumber]['name'] = siteName;
        stationData[siteNumber]['lat'] = lat;
        stationData[siteNumber]['lon'] = lon;
        stationData[siteNumber]['data'][variable] = value;
    }
    return stationData;
}

function convertToGeoJson(extractedData) {
    var siteNumbers = Object.keys(extractedData);
    features = [];
    for (var i in siteNumbers) {
        siteNumber = siteNumbers[i];
        stationData = extractedData[siteNumber];
        var siteName = stationData.name;
        var lat = stationData.lat;
        var lon = stationData.lon;
        var siteData = stationData.data; 
        turfpt = turf.point(lon, lat, {name:siteName,
                                       number:siteNumber,
                                       data:siteData});
        features.push(turfpt);
    }
    return turf.featurecollection(features);
}

function buildPopupString(feature) {
    popupString = ('<b>' + feature.properties.name + '<br>' +
                   'Gage Number: ' + feature.properties.number + '</b>' +
                   '<ul>');
    var variables = Object.keys(feature.properties.data);
    for (var i in variables) {
        variable = variables[i];
        value = feature.properties.data[variable];
        popupString = (popupString + '<li>' + variable + 
                       ' = ' + value + '</li>');
    }
    popupString = popupString + '</ul>';
    return popupString
}


function getFlows(states) {
    for (var i = 0; i < states.length; i++) {
        var result = httpGet(buildRequest(states[i]));
        console.log(states[i] + ' - data received.');
        var extracted = extractStationData(result);
        var stations = convertToGeoJson(extracted);
        L.geoJson(stations, {
            onEachFeature: function(feature, layer) {
                layer.bindPopup(buildPopupString(feature));
            }
        }).addTo(map);
    }
}
