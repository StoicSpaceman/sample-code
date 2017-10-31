'use strict';

var adelaide = new google.maps.LatLng(-34.9174249,138.5947491);
var austin = new google.maps.LatLng(30.2746378,-97.7403547);
// Create your own API as per https://support.nearmap.com/hc/en-us/articles/115006379787-API-Key-Authentication
var apikey = 'OWZkNzIwMTctNjNkMS00NDU2LWJlYzItNzI4ZTFjYjM1MzAw';

function degreesToRadians(deg) {
	return deg * (Math.PI / 180);
}

function radiansToDegrees(rad) {
	return rad / (Math.PI / 180);
}

function rotateLatLng(latlng, heading){
	var lat = latlng.lat();
	var lng = latlng.lng();

	switch(heading){
		case 0:
			break;
		case 90:
			lng = -lng;
			break;
		case 180:
			lat = -lat;
			lng = -lng;
			break;
		case 270:
			lat = -lat;
			break;
	}
	return new google.maps.LatLng(lat, lng);
}

function rotatePoint(point, heading){
	if(heading === 0 || heading === 180){
		return new google.maps.Point(point.x, point.y);
	}else{
		return new google.maps.Point(point.y, point.x);
	}
}

//return the region from which to load a tile.
//convert coordinate to a zoom level 1 and return us if it happens to be in the
//top left corner of the world
function regionForCoordinate(x,y,zoom) {
    var x_z1 = x/Math.pow(2,(zoom - 1));
    if (x_z1 < 1) {
        return 'us';
    } else {
        return 'au';
    }
}

function MercatorProjection(tileWidth, tileHeight, heading){
	this.heading = heading;

	this.pixelOrigin = new google.maps.Point(
		tileWidth / 2, tileHeight / 2);

	if(heading === 0 || heading === 180){
		this.pixelsPerLonDegree = tileWidth / 360;
		this.pixelsPerLatRadian = tileHeight / (2 * Math.PI);
	}else{
		this.pixelsPerLonDegree = tileHeight / 360;
		this.pixelsPerLatRadian = tileWidth / (2 * Math.PI);
	}
};

MercatorProjection.prototype.fromLatLngToPoint=function(latlng, opt_point) {
	var point = opt_point || new google.maps.Point(0, 0);

	var origin = rotatePoint(this.pixelOrigin, this.heading);
	latlng = rotateLatLng(latlng, this.heading);

	var lat = latlng.lat();
	var lng = latlng.lng();

	point.x = origin.x + lng * this.pixelsPerLonDegree;

	var siny = Math.sin(degreesToRadians(lat));
	point.y = origin.y + 0.5 * Math.log((1 + siny) / (1 - siny)) *
		-this.pixelsPerLatRadian;

	return rotatePoint(point, this.heading);
};

MercatorProjection.prototype.fromPointToLatLng = function(point, noWrap) {
	var origin = rotatePoint(this.pixelOrigin, this.heading);
	point = rotatePoint(point, this.heading);

	var lng = (point.x - origin.x) / this.pixelsPerLonDegree;
	var latRadians = (point.y - origin.y) / -this.pixelsPerLatRadian;
	var lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) -
		Math.PI / 2);

	return rotateLatLng(new google.maps.LatLng(lat, lng), this.heading);
};

function createMapType(tileWidth, tileHeight, heading, name){

	var maptype = new google.maps.ImageMapType({
		getTileUrl: function(coord, zoom) {
			var numTiles = 1 << zoom;

			switch(heading){
				case 90:
					coord = new google.maps.Point(
						numTiles - (coord.y + 1),
						coord.x
					);
					break;
				case 180:
					coord = new google.maps.Point(
						numTiles - (coord.x + 1),
						numTiles - (coord.y + 1)
					);
					break;
				case 270:
					coord = new google.maps.Point(
						coord.y,
						numTiles - (coord.x + 1)
					);
            }


			var x = coord.x;
			var y = coord.y;
			var url = 'http://'+
                regionForCoordinate(x,y,zoom) + 
                '0.nearmap.com/maps/hl=en' +
				'&x=' + x +
				'&y=' + y +
				'&z=' + zoom +
				'&nml=' + name + '&httpauth=false&version=2' +
                '&apikey=' + apikey;
			return url;
		},
		tileSize: new google.maps.Size(tileWidth, tileHeight),
		isPng: true,
		minZoom: 1,
		maxZoom: 24,
		name: name
	});
	maptype.projection = new MercatorProjection(
			tileWidth, tileHeight, heading);
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
		  map.setCenter(point);
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

	for(var i=0; i<map_types.length;i++){
		var mt = map_types[i];
		map.mapTypes.set(mt.name, mt);
	}

	map.setMapTypeId('Vert');

	createBookmarkControl(map);
}

google.maps.event.addDomListener(window, 'load', initialize);
