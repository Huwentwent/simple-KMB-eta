const radiusSelect = document.getElementById("radius");
const output = document.getElementById("output");
let user_lat, user_lon;

if (!navigator.geolocation)
{
    output.innerHTML = "<p>Geolocation is not supported by your browser</p>";
}
else
{
    navigator.geolocation.getCurrentPosition(success, error);
}

function success(position)
{
    user_lat = position.coords.latitude;
    user_lon = position.coords.longitude;
    const radius = radiusSelect.value;
    search_bus_stop(user_lat, user_lon, radius);
}

function error()
{
    output.innerHTML = "<p>Unable to retrieve your location</p>";
}

function search_bus_stop(lat, lon, radius)
{
    const stop_url = "https://data.etabus.gov.hk/v1/transport/kmb/stop";
    const cache = sessionStorage.getItem("stop_lists");
    if (cache) 
    {
        processStopList(JSON.parse(cache), lat, lon, radius);
    }
    else
    {
        fetch(stop_url)
            .then(response => response.json())
            .then(data =>
            {
                sessionStorage.setItem("stop_lists", JSON.stringify(data));
                processStopList(data, lat, lon, radius);
            })
            .catch(err =>
            {
                console.error("Error fetching stop list:", err);
                output.innerHTML = "<p>Error fetching bus stop data</p>";
            });

    }
}

function processStopList(data, lat, lon, radius)
{
    const bus_stops = data.data;
    const nearbyStops = [];
    bus_stops.forEach(bus_stop =>
    {
        const stop_lat = parseFloat(bus_stop.lat);
        const stop_lon = parseFloat(bus_stop.long);
        const dist = distance(lat, stop_lat, lon, stop_lon);
        if (dist <= radius)
        {
            nearbyStops.push({
                stop: bus_stop.stop,
                name_en: bus_stop.name_en,
                lat: stop_lat,
                lon: stop_lon,
                dist: dist
            });
        }
    });
    displayBusStops(nearbyStops);
}

function displayBusStops(stops)
{
    output.innerHTML = "";
    if (stops.length === 0)
    {
        output.innerHTML = "<p>Cannot locate nearby bus stops</p>";
        return;
    }
    stops.sort((a, b) => a.dist - b.dist);
    stops.forEach(stop =>
    {

        const distance_and_stop_field = document.createElement("div");
        distance_and_stop_field.className = "distance_and_stop_field";

        const heading_field = document.createElement("div");
        heading_field.className = "heading_field";

        const distance_element = document.createElement("span");
        distance_element.className = "distance";
        distance_element.innerHTML = `Distance: ${Math.round(stop.dist)}m `;

        const stopElement = document.createElement("span");
        stopElement.className = "bus_stop_name";
        stopElement.innerHTML = `${stop.name_en}`;

        heading_field.appendChild(distance_element);
        heading_field.appendChild(stopElement);
        distance_and_stop_field.appendChild(heading_field);


        const detailsContainer = document.createElement("div");
        detailsContainer.className = "details_container";

        const etaInfo = document.createElement("div");
        etaInfo.className = "eta_info";

        const mapContainer = document.createElement("div");
        mapContainer.className = "map_container";

        detailsContainer.appendChild(etaInfo);
        detailsContainer.appendChild(mapContainer);
        distance_and_stop_field.appendChild(detailsContainer);

        distance_and_stop_field.addEventListener("click", () =>
        {
            document.querySelectorAll(".distance").forEach(element => element.classList.remove("selected_field"));
            document.querySelectorAll(".bus_stop_name").forEach(element => element.classList.remove("selected_field"));

            document.querySelectorAll(".details_container").forEach(element => element.style.display = "none");
            detailsContainer.style.display = "flex";
            search_bus_route(stop.stop, stop.lat, stop.lon, etaInfo, mapContainer);
    
            distance_and_stop_field.querySelector(".distance").classList.add("selected_field");
            distance_and_stop_field.querySelector(".bus_stop_name").classList.add("selected_field");

            heading_field.scrollIntoView(true);
        })
        output.appendChild(distance_and_stop_field);

    })
}

function search_bus_route(stop_code, stopLat, stopLon, etaInfo, mapContainer)
{
    const eta_url = `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stop_code}`;
    fetch(eta_url)
        .then(response => response.json())
        .then(data =>
        {
            const eta_data = data.data.filter(eta => eta.eta !== null);
            if (eta_data.length === 0)
            {
                etaInfo.innerHTML = "<p>No bus route information</p>";
            }
            else
            {
                const routes_data = {};
                etaInfo.innerHTML = "";

                eta_data.forEach(bus_route =>
                {
                    const bus_route_number = bus_route.route;
                    const bus_direction = bus_route.dir;
                    const bus_service_type = bus_route.service_type;
                    const bus_destination = bus_route.dest_en;
                    const bus_eta_sequence_number = bus_route.eta_seq;
                    const bus_eta = bus_route.eta;

                    const route_key = `${bus_route_number}:${bus_direction}`;
                    if (!routes_data[route_key])
                    {
                        // route_info
                        routes_data[route_key] = {
                            route: bus_route_number,
                            direction: bus_direction,
                            service_type: bus_service_type,
                            destination: bus_destination,
                            eta_sequence: bus_eta_sequence_number,
                            eta: []
                        };
                    }
                    if (routes_data[route_key].eta.length < 3)
                    {
                        routes_data[route_key].eta.push(bus_eta);
                    }
                });

                for (const key in routes_data)
                {
                    const route_info = routes_data[key];
                    const eta_times = route_info.eta.map(eta =>
                        new Date(eta).toLocaleTimeString(["en-US"], { hour: "2-digit", minute: "2-digit" })
                    );

                    const etaElement = document.createElement("div");
                    etaElement.className = "etaElement";

                    const etaElement_route = document.createElement("span");
                    etaElement_route.className = "etaElement_route";
                    etaElement_route.innerHTML = `${route_info.route}`;

                    const etaElement_destination = document.createElement("span");
                    etaElement_destination.className = "etaElement_destination";
                    etaElement_destination.innerHTML = `${route_info.destination}`;

                    const etaElement_eta = document.createElement("div");
                    etaElement_eta.className = "etaElement_eta";
                    etaElement_eta.innerHTML = `${eta_times.join(" ")}`;

                    etaElement.appendChild(etaElement_route);
                    etaElement.appendChild(etaElement_destination);
                    etaElement.appendChild(etaElement_eta);

                    etaInfo.appendChild(etaElement);
                }
                renderMap(stopLat, stopLon, mapContainer);


            }
        })
        .catch(err =>
        {
            console.error("Error fetching ETA:", err);
            etaInfo.innerHTML = "<p>Error fetching ETA data</p>";
            renderMap(stopLat, stopLon, mapContainer);
        })

}

function renderMap(stopLat, stopLon, mapContainer)
{
    mapContainer.innerHTML = "";
    const center_lat = (user_lat + stopLat) / 2;
    const center_lon = (user_lon + stopLon) / 2;
    const radius = radiusSelect.value;
    let zoom_level;

    switch (radius)
    {
        case "100":
            zoom_level = 19;
            break;
        case "200":
            zoom_level = 18;
            break;
        case "300":
            zoom_level = 17;
            break;
        case "400":
            zoom_level = 16;
            break;
        case "500":
            zoom_level = 16;
            break;
    }

    const map = new ol.Map({
        target: mapContainer,
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([center_lon, center_lat]),
            zoom: zoom_level
        })
    });

    const user_marker = new ol.Feature(
        {
            geometry: new ol.geom.Point(ol.proj.fromLonLat([user_lon, user_lat])),
        }
    )
    const user_icon = new ol.style.Style(
        {
            image: new ol.style.Icon({
                src: 'map-marker.ico'
            })
        }
    )
    user_marker.setStyle(user_icon);

    const stop_marker = new ol.Feature(
        {
            geometry: new ol.geom.Point(ol.proj.fromLonLat([stopLon, stopLat])),
        }
    )
    const stop_icon = new ol.style.Style(
        {
            image: new ol.style.Icon({
                src: 'bus-icon.ico'
            })
        }
    )
    stop_marker.setStyle(stop_icon);

    const marker_layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [user_marker, stop_marker]
        })
    })
    map.addLayer(marker_layer);

}

function distance(lat1, lat2, lon1, lon2)
{
    const R = 6371e3; // earth's radius in meters
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // in meters
    return d;
}


radiusSelect.addEventListener("change", () =>
{
    const new_radius = radiusSelect.value;
    if (user_lat && user_lon)
    {
        search_bus_stop(user_lat, user_lon, new_radius);
    }
});

output.scrollIntoView(true);