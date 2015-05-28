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

function markerClusterSize(n) {
    if (n >= 100) {
        size = 30;
    } else if (n >= 50) {
        size = 25;
    } else if (n >= 25) {
        size = 22;
    } else if (n >= 10) {
        size = 20;
    } else {
        size = 15;
    }
    return size;
}

function markerClusterColor(avgPcntValue) {
    var color = int(avgPcntValue * 255);
    return color;
}

function cleanStats(stats) {
    var cleanedStats = {};
    var statVars = {'min_va': 0.00,
                    'p05_va': 0.05,
                    'p10_va': 0.10,
                    'p20_va': 0.20,
                    'p25_va': 0.25,
                    'p50_va': 0.50,
                    'p75_va': 0.75,
                    'p80_va': 0.80,
                    'p90_va': 0.90,
                    'p95_va': 0.95,
                    'max_va': 1.00};
    var statVarKeys = Object.keys(statVars);
    for (var i = 0; i < statsVarKeys.length; i++) {
        var statVarName = statVarKeys[i];
        var statValue = stats[statVarName];
        if (statValue != '') {
            cleanedStats[statVarName] = statValue;
    }
    return cleanedStats;
}


function pcntValue(value, stats) {
    var pcntSteps = {0.00: stats.min_va, 
                     0.05: stats.p05_va,
                     0.10: stats.p10_va,
                     0.20: stats.p20_va,
                     0.25: stats.p25_va,
                     0.50: stats.p50_va,
                     0.75: stats.p75_va,
                     0.80: stats.p80_va,;
                     0.90: stats.p90_va,
                     0.95: stats.p95_va,
                     1.00: stats.max_va};
    var pcntKeys = Object.keys(pcntSteps);
    if (value <= stats.min_va) {
        return 0.00;
    } else if (value >= stats.max_va) {
        return 1.00;
    } else {
        for (var i = 0; i < pcntKeys.length; i++) {
            var pcntThis = pcntKeys[i];
            var pcntNext = pcntKeys[i+1];
            var valThis = float(pcntSteps[pcntThis]);
            var valNext = float(pcntSteps[pcntNext]);
            if (valThis <= value <= valNext) {
                valRatio = (value - valThis) / (valNext - valThis);
                pcntRemainder = (pcntNext - pcntThis) * valRatio;
                pcnt = pcntThis + pcntRemainder;
                return pcnt;
            }
}

function mapMarkerCluster(responseText) {
    extracted = extractStationData(responseText);
    geoJsonData = convertToGeoJson(extracted);
    var markers = new L.MarkerClusterGroup({
        iconCreateFunction: function(cluster) {
            var markers = cluster.getAllChildMarkers();
            var n = 0;
            for (var i = 0; i < markers.length; i++) {
                var flow = markers[i]['00060'];
                if (flow > -999999 && !(flow===undefined)) {
                    //n += Number(flow);
                    n += 1;
                };
            }
            size = markerClusterSize(n)
            return new L.DivIcon({ html: '<b>' + n.toString() + '</b>',
                                   className: 'mycluster',
                                   iconSize: L.point(size, size) });
        }
    });
    for (var i in geoJsonData.features) {
        feature = geoJsonData.features[i];
        lat = feature.geometry.coordinates[1];
        lon = feature.geometry.coordinates[0];
        marker = L.marker(new L.LatLng(lat, lon), { });
        popup = buildPopupString(feature);
        marker.bindPopup(popup);
        marker['asdf'] = 10;
        for (var j in feature.properties.variables) {
            var varCode = feature.properties.variables[j];
            marker[varCode] = feature.properties[varCode];
        }
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
