// GLobal array for storing variable code names.
var VARIABLE_CODES = {};

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

function extractStationData(rawUsgsData) {
    var jsonified = JSON.parse(rawUsgsData);
    timeSeries = jsonified.value.timeSeries;
    stationData = {};
    for (var i in timeSeries) {
        station = timeSeries[i];
        try {
            var siteName = station.sourceInfo.siteName;
            var siteNumber = station.sourceInfo.siteCode[0].value;
            var lat = station.sourceInfo.geoLocation.geogLocation.latitude;
            var lon = station.sourceInfo.geoLocation.geogLocation.longitude;
            var variable = station.variable.variableName;
            var value = station.values[0].value[0].value;
        } catch(err) {
            console.log('Error - ' + siteNumber);
        }
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
        var siteVariables = Object.keys(siteData);
        var properties = {'name':siteName, 
                          'number':siteNumber,
                          'variables':siteVariables};
        for (var i in siteVariables) {
            siteVariable = siteVariables[i];
            properties[siteVariable] = siteData[siteVariable];
        }
        turfpt = turf.point(lon, lat, properties);
        console.log(turfpt);
        features.push(turfpt);
    }
    return turf.featurecollection(features);
}

function buildPopupString(feature) {
    popupString = ('<b>' + feature.properties.name + '<br>' +
                   'Gage Number: ' + feature.properties.number + '</b>' +
                   '<ul>');
    var variables = feature.properties.variables;
    for (var i in variables) {
        variable = variables[i];
        value = feature.properties[variable];
        popupString = (popupString + '<li>' + variable + 
                       ' = ' + value + '</li>');
    }
    popupString = popupString + '</ul>';
    return popupString;
}

function getGeoJsonData(state) {
    result = httpGet(buildRequest(state));
    console.log(state + ' - data received.');
    extracted = extractStationData(result);
    stations = convertToGeoJson(extracted);
    return stations;
}

function mapState(state) {
    geoJsonData = getGeoJsonData(state);
    L.geoJson(geoJsonData, {
        onEachFeature: function(feature, layer) {
            popupString = buildPopupString(feature);
            layer.bindPopup(popupString);
        }
    }).addTo(map);
    console.log(geoJsonData);
}

function mapStateIsolines(state, variable, resolution, breaks) {
    geoJsonData = getGeoJsonData(state);
    console.log(state + ' - processing isolines');
    isolined = turf.isolines(geoJsonData, variable, resolution, breaks);
    console.log(state + ' - finished processing isolines');
    L.geoJson(isolined).addTo(map);
}
