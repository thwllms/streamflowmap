// GLobal array for referencing variable codes/names.
var VARIABLE_CODES = {};

function createCORSRequest(method, url) {
    var xhr = new XMLHttpRequest();
    if ("withCredentials" in xhr) { 
        xhr.open(method, url, true);
    } else if (typeof XDomainRequest!="undefined") {
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        xhr = null;
    }
    return xhr;
}

function httpGet(theURL, callback) {
    var request = createCORSRequest('GET', theURL);
    request.onload = function() {
        console.log(theURL)
        callback(this.responseText);
    }
    request.send();
}

function buildStateRequest(state) {
    // Builds request URL for a given state
    var pathBegin = 'http://waterservices.usgs.gov/nwis/iv/?stateCd=';
    var pathEnd = '&format=json';
    var path = pathBegin + state + pathEnd;
    return path;
}

function buildBboxRequest(box) {
    // Builds request URL for a lat-lon box
    var pathBegin = 'http://waterservices.usgs.gov/nwis/iv/?bBox=';
    lon1 = box[0][0];
    lat1 = box[0][1];
    lon2 = box[1][0];
    lat2 = box[1][1];
    latlon_string = [lon1, lat1, lon2, lat2].join();
    var pathEnd = '&format=json';
    var path = pathBegin + latlon_string + pathEnd;
    return path;
}

function buildGageSiteURL(gage) {
    var pathBegin = 'http://waterdata.usgs.gov/usa/nwis/uv?site_no=';
    var path = pathBegin + gage;
    return path
}

function extractStationData(rawUsgsData) {
    var jsonified = JSON.parse(rawUsgsData);
    timeSeries = jsonified.value.timeSeries;
    extractedData = {};
    for (var i in timeSeries) {
        station = timeSeries[i];
        try {
            var siteName = station.sourceInfo.siteName;
            var siteNumber = station.sourceInfo.siteCode[0].value;
            var lat = station.sourceInfo.geoLocation.geogLocation.latitude;
            var lon = station.sourceInfo.geoLocation.geogLocation.longitude;
            var variableName = station.variable.variableName;
            var variableCode = station.variable.variableCode[0].value;
            VARIABLE_CODES[variableCode] = variableName;
            var value = station.values[0].value[0].value;
        } catch(err) {
            console.log('Error - ' + siteNumber);
        }
        if (!(siteNumber in extractedData)) {
            extractedData[siteNumber] = {'data':{}};
        }
        extractedData[siteNumber]['name'] = siteName;
        extractedData[siteNumber]['lat'] = lat;
        extractedData[siteNumber]['lon'] = lon;
        extractedData[siteNumber]['data'][variableCode] = value;
    }
    return extractedData;
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
        features.push(turfpt);
    }
    return turf.featurecollection(features);
}

function buildPopupString(feature) {
    var gageName = feature.properties.name;
    var gageNumber = feature.properties.number;
    var gageSiteURL = buildGageSiteURL(gageNumber);
    popupString = ('<a href="' + gageSiteURL + '" target="_blank">' +
                   '<b>' + gageName + '<br>' +
                   'Gage Number: ' + gageNumber + '</b></a>' +
                   '<ul>');
    var variables = feature.properties.variables;
    for (var i in variables) {
        variable = variables[i];
        variableName = VARIABLE_CODES[variable];
        value = feature.properties[variable];
        if (value == -999999) {
        };
        popupString = (popupString + '<li>' + variableName + 
                       ' = ' + value + '</li>');
    }
    popupString = popupString + '</ul>';
    return popupString;
}

function mapMarkerCluster(responseText) {
    extracted = extractStationData(responseText);
    geoJsonData = convertToGeoJson(extracted);
    var markers = new L.MarkerClusterGroup();
    for (var i in geoJsonData.features) {
        feature = geoJsonData.features[i];
        lat = feature.geometry.coordinates[1];
        lon = feature.geometry.coordinates[0];
        marker = L.marker(new L.LatLng(lat, lon), { });
        popup = buildPopupString(feature);
        marker.bindPopup(popup);
        markers.addLayer(marker);
    }
    map.addLayer(markers);
}

function mapStateMarkerClusters(states) {
    for (i in states) {
        state = states[i];
        httpGet(buildStateRequest(state), mapMarkerCluster);
    }
}

function mapStateIsolines(state, variable, resolution, breaks) {
    geoJsonData = getStateGeoJsonData(state);
    console.log(state + ' - processing isolines');
    isolined = turf.isolines(geoJsonData, variable, resolution, breaks);
    console.log(state + ' - finished processing isolines');
    L.geoJson(isolined).addTo(map);
}
