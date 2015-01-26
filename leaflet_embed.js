var map;

function initmap() {
    // set up the map
    map = new L.map('map');

    // create the tile layer
    var osmURL = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osm = new L.TileLayer(osmURL, {
        attribution: 'asdf'});

    map.setView(new L.LatLng(50.5, -30.5),2);
    map.addLayer(osm);
}

function addpoint(lat, lon, text) {
    var marker = new L.marker([lat, lon]);
    marker.bindPopup(text).openPopup()
    map.addLayer(marker);
}

