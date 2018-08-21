'use strict';

var adelaide = new google.maps.LatLng(-34.9174249,138.5947491);
var austin = new google.maps.LatLng(30.2746378,-97.7403547);
// Create your own API as per https://support.nearmap.com/hc/en-us/articles/115006379787-API-Key-Authentication
var apikey = 'ZjNhZDkyNDUtZjIyMS00NTkwLWJlMzYtZDJlNWUyNDkxNjE4';


function degreesToRadians(deg) {
  return deg * (Math.PI / 180);
}

function radiansToDegrees(rad) {
  return rad / (Math.PI / 180);
}


/**
 * Return the region from which to load a tile.
 * Convert coordinate to a zoom level 1 and return
 * 'us' if it happens to be in the top left corner of the world
 */
function regionForCoordinate(x, y, zoom) {
  var x_z1 = x / Math.pow(2, (zoom - 1));
  if (x_z1 < 1) {
      return 'us';
  } else {
      return 'au';
  }
}


/**
 * Calculate the true tile coordinate for a given google maps `coord`, `zoom`
 * and `heading`.
 *
 * Nearmap tiles are layed out as follow:
 * ```
 *   Vert/North       East          South          West
 * -------------  -------------  -------------  -------------
 * | 0,0 | 1,0 |  | 1,0 | 1,1 |  | 1,1 | 0,1 |  | 0,1 | 0,0 |
 * |-----|-----|  |-----|-----|  |-----|-----|  |-----|-----|
 * | 0,1 | 1,1 |  | 0,0 | 0,1 |  | 1,0 | 0,0 |  | 1,1 | 1,0 |
 * -------------  -------------  -------------  -------------
 *```
 * Depending on the heading the tile coordinates are simply rotated
 * around the center of the fully tiled map at the given zoom level.
 */
function rotateTile(coord, zoom, heading) {
  var numTiles = 1 << zoom; // 2^zoom
  var x, y;

  switch(heading){
    case 0:
      x = coord.x;
      y = coord.y;
      break;
    case 90:
      x = numTiles - (coord.y + 1);
      y = coord.x;
      break;
    case 180:
      x = numTiles - (coord.x + 1);
      y = numTiles - (coord.y + 1);
      break;
    case 270:
      x = coord.y;
      y = numTiles - (coord.x + 1);
      break;
  }
  return new google.maps.Point(x, y);
}


/**
* A Mercator like projection that allows for non square world coordinates
* given the `worldWidth` `worldHeight`.
*
* see https://developers.google.com/maps/documentation/javascript/maptypes#Projections
*/
function MercatorProjection(worldWidth, worldHeight){
  this.pixelOrigin = new google.maps.Point(worldWidth / 2, worldHeight / 2);
  this.pixelsPerLonDegree = worldWidth / 360;
  this.pixelsPerLatRadian = worldHeight / (2 * Math.PI);
}

MercatorProjection.prototype.fromLatLngToPoint=function(latlng, opt_point) {
  var point = opt_point || new google.maps.Point(0, 0);
  var origin = this.pixelOrigin;

  var lat = latlng.lat();
  var lng = latlng.lng();

  point.x = origin.x + lng * this.pixelsPerLonDegree;
  var siny = Math.sin(degreesToRadians(lat));
  point.y = origin.y + 0.5 * Math.log((1 + siny) / (1 - siny)) *
    -this.pixelsPerLatRadian;

  return point;
};

MercatorProjection.prototype.fromPointToLatLng = function(point, noWrap) {
  var origin = this.pixelOrigin;

  var lng = (point.x - origin.x) / this.pixelsPerLonDegree;
  var latRadians = (point.y - origin.y) / -this.pixelsPerLatRadian;
  var lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2);

  return new google.maps.LatLng(lat, lng);
};


const projVertical = new MercatorProjection(256, 256);

function vertToWest(ll) {
  var pt = projVertical.fromLatLngToPoint(ll);
  pt = new google.maps.Point(pt.y, pt.x);
  ll = projVertical.fromPointToLatLng(pt);
  return new google.maps.LatLng(ll.lat(), -ll.lng());
}

function westToVert(ll) {
  ll = new google.maps.LatLng(ll.lat(), -ll.lng());
  var pt = projVertical.fromLatLngToPoint(ll);
  pt = new google.maps.Point(pt.y, pt.x);
  return projVertical.fromPointToLatLng(pt);
}

function vertToEast(ll) {
  var pt = projVertical.fromLatLngToPoint(ll);
  pt = new google.maps.Point(pt.y, pt.x);
  ll = projVertical.fromPointToLatLng(pt);
  return new google.maps.LatLng(-ll.lat(), ll.lng());
}

function eastToVert(ll) {
	ll = new google.maps.LatLng(-ll.lat(), ll.lng());
  var pt = projVertical.fromLatLngToPoint(ll);
  pt = new google.maps.Point(pt.y, pt.x);
  return projVertical.fromPointToLatLng(pt);
}

/**
 * Convert a `ll` top a fake LatLng for a map using
 * any of the obliquie base-layers with the given `mapTypeId`.
 */
function fakeLatLng(mapTypeId, ll) {
  if (mapTypeId === 'W') {
    ll = vertToWest(ll);
  } else if (mapTypeId === 'E') {
    ll = vertToEast(ll);
  } else if (mapTypeId === 'S') {
    ll = new google.maps.LatLng(-ll.lat(), -ll.lng());
  }
  return ll;
}

/**
 * Convert a fake `ll` to a reaal LatLng for a map using
 * any of the obliquie base-layers with the given `mapTypeId`.
 */
function realLatLng(mapTypeId, ll) {
  if (mapTypeId === 'W') {
    ll = westToVert(ll);
  } else if (mapTypeId === 'E') {
    ll = eastToVert(ll);
  } else if (mapTypeId === 'S') {
    ll = new google.maps.LatLng(-ll.lat(), -ll.lng());
  }
  return ll;
}

/**
 * Install a base-layer change handler to update the `map`'s center so that
 * the new base-layer shows the same geographic location as the previous layer.
 */
function registerProjectionWorkaround(map) {
	var currMapType = map.getMapTypeId();

  map.addListener('maptypeid_changed', function() {
    var center = realLatLng(currMapType, map.getCenter());
    currMapType = map.getMapTypeId();
    map.setCenter(fakeLatLng(currMapType, center));
  });
}


function createMapType(tileWidth, tileHeight, heading, name){
  var maptype = new google.maps.ImageMapType({
    name: name,
    tileSize: new google.maps.Size(tileWidth, tileHeight),
    isPng: true,
    minZoom: 1,
    maxZoom: 24,
    getTileUrl: function(coord, zoom) {
      coord = rotateTile(coord, zoom, heading);

      var x = coord.x;
      var y = coord.y;
      var url = 'http://'+ regionForCoordinate(x, y, zoom) +
        '0.nearmap.com/maps/hl=en' +
        '&x=' + x +
        '&y=' + y +
        '&z=' + zoom +
        '&nml=' + name + '&httpauth=false&version=2' +
        '&apikey=' + apikey;
      return url;
    }
  });
  maptype.projection = new MercatorProjection(tileWidth, tileHeight);
  return maptype;
}

function createBookmarkControl(map) {
  // Create the DIV to hold the control and call the bookmarkControl()
  // constructor passing in this DIV.
  var bookmarkControlDiv = document.createElement('div');
  var bookmarkControl = new BookmarkControl(bookmarkControlDiv, map);

  bookmarkControlDiv.index = 1;
  map.controls[google.maps.ControlPosition.TOP_CENTER].push(bookmarkControlDiv);
}

/**
* The BookmarkControl adds a control to the map that has two bookmarks for
* the Nearmap demo areas
* This constructor takes the control DIV as an argument.
* @constructor
*/
function BookmarkControl(controlDiv, map) {

  /**
   * Create an actual control HTML element and add an event listener that centers the map
   * on a point provided by the point argument
   */
  function createBookmarkLink(label, point){
    var bookmarkLink = document.createElement('span');
    bookmarkLink.className = 'bookmark-link';
    bookmarkLink.innerHTML = label;

    bookmarkLink.addEventListener('click', function() {
			 // To ensure that the correct imagery is shown we need to
			 // get a fake LatLng for E+S+W oblique imagery.
       map.setCenter(fakeLatLng(map.getMapTypeId(), point));
    });

    return bookmarkLink;
  }

  // Set CSS for the control border.
  var bookmarkContainer = document.createElement('div');
  bookmarkContainer.className = 'bookmark-container';
  controlDiv.appendChild(bookmarkContainer);

  bookmarkContainer.appendChild(createBookmarkLink('Australia', adelaide));
  bookmarkContainer.appendChild(createBookmarkLink('USA', austin));
}


function initialize() {
  if (apikey === undefined || apikey.length === 0) {
    alert('Please provide your Nearmap API Key');
    return;
  }

  var map_types=[
    createMapType(256, 256, 0, 'Vert'),
    createMapType(256, 181, 0, 'N'),
    createMapType(256, 181, 90, 'E'),
    createMapType(256, 181, 180, 'S'),
    createMapType(256, 181, 270, 'W'),
  ];

  var mapOptions = {
    zoom: 19,
    center: adelaide,
    mapTypeControlOptions: {
      mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'Vert', 'N', 'E', 'S', 'W']
    }
  };
  var map = new google.maps.Map(document.getElementById('map'), mapOptions);

  for(var i=0; i<map_types.length; i++){
    var mt = map_types[i];
    map.mapTypes.set(mt.name, mt);
  }

	registerProjectionWorkaround(map);

  map.setMapTypeId('Vert');

  createBookmarkControl(map);
}

google.maps.event.addDomListener(window, 'load', initialize);
