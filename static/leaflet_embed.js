var map;

function initmap() {
    // set up the map
    map = new L.map('map');
    var terrain = new L.StamenTileLayer("terrain", {
        attribution: 'asdf'});
    map.setView(new L.LatLng(35, -80), 5);
    map.addLayer(terrain);
}
