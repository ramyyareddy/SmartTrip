
import React, { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const HYDERABAD = [17.385, 78.4867];

const FitMapView = ({
  startPosition,
  destinationPosition,
  placePositions,
  journeyLine,
}) => {
  const map = useMap();

  useEffect(() => {
    const positions = [
      ...(startPosition ? [startPosition] : []),
      ...(placePositions || []).map((place) => place.position),
      ...(destinationPosition ? [destinationPosition] : []),
    ];

    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), {
        padding: [40, 40],
        maxZoom: 11,
      });
    } else if (destinationPosition) {
      map.setView(destinationPosition, 11);
    }

    const timer = setTimeout(() => map.invalidateSize(), 150);

    return () => clearTimeout(timer);
  }, [
    startPosition,
    destinationPosition,
    placePositions,
    journeyLine,
    map,
  ]);

  return null;
};

const geocodePhoton = async (query) => {
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`
  );

  if (!response.ok) {
    throw new Error("Photon request failed");
  }

  const data = await response.json();

  return (data.features || [])
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates;

      if (!coordinates || coordinates.length < 2) {
        return null;
      }

      return {
        position: [
          Number(coordinates[1]),
          Number(coordinates[0]),
        ],
        properties: feature.properties || {},
      };
    })
    .filter(Boolean);
};

const geocodeNominatim = async (query) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error("Nominatim request failed");
  }

  const data = await response.json();

  return (data || [])
    .map((item) => {
      if (!item.lat || !item.lon) {
        return null;
      }

      return {
        position: [
          Number(item.lat),
          Number(item.lon),
        ],
        properties: {
          ...item,
          name: item.name || item.display_name,
          display_name: item.display_name,
        },
      };
    })
    .filter(Boolean);
};

const geocode = async (query) => {
  if (!query?.trim()) {
    return [];
  }

  try {
    const results = await geocodePhoton(query);

    if (results.length) {
      return results;
    }
  } catch (error) {
    console.warn("Photon geocoding failed:", query, error);
  }

  try {
    return await geocodeNominatim(query);
  } catch (error) {
    console.warn("Nominatim geocoding failed:", query, error);
    return [];
  }
};

const distanceKm = (a, b) => {
  if (!a || !b) {
    return Infinity;
  }

  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const rad = Math.PI / 180;

  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(
    Math.sqrt(h),
    Math.sqrt(1 - h)
  );
};

// This is a visual journey arc, not an actual flight path.
const createCurvedJourneyLine = (
  start,
  end,
  segments = 80
) => {
  if (!start || !end) {
    return [];
  }

  let lon1 = start[1];
  let lon2 = end[1];

  if (Math.abs(lon2 - lon1) > 180) {
    if (lon2 > lon1) {
      lon1 += 360;
    } else {
      lon2 += 360;
    }
  }

  const distance = distanceKm(start, end);
  const height = Math.min(
    18,
    Math.max(1.5, distance / 900)
  );

  const points = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    const lat =
      start[0] +
      (end[0] - start[0]) * t +
      Math.sin(Math.PI * t) * height;

    let lon = lon1 + (lon2 - lon1) * t;

    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;

    points.push([lat, lon]);
  }

  return points;
};

const cleanMapPlace = (place) => {
  let text = String(place || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text.split(/\s+[–—]\s+|\s+-\s+/)[0];
  text = text.split(/\.\s+/)[0];

  return text.replace(/^["“”']+|["“”']+$/g, "").trim();
};

const isExcludedPlace = (place) => {
  const cleaned = place
    .replace(/[.!,:;]+$/g, "")
    .trim();

  return /^(hotel|accommodation|lodging|free time|leisure time)$/i.test(
    cleaned
  );
};

const normalizePlaceList = (places = []) => {
  const normalized = places.map((place) => {
    if (typeof place === "string") {
      return cleanMapPlace(place);
    }

    return cleanMapPlace(
      place?.name ||
        place?.place ||
        place?.title ||
        ""
    );
  });

  return [
    ...new Set(
      normalized.filter(
        (place) => place && !isExcludedPlace(place)
      )
    ),
  ];
};

const getCountry = (properties = {}) =>
  String(properties.country || "").trim().toLowerCase();

const geocodePlaceNearDestination = async (
  place,
  destination,
  destinationPosition,
  destinationProperties
) => {
  if (!place || !destination || !destinationPosition) {
    return null;
  }

  const queries = [
    ...new Set([
      `${place}, ${destination}`,
      place,
    ]),
  ];

  const candidates = [];

  for (const query of queries) {
    console.log("SmartTrip geocoding query:", query);

    try {
      candidates.push(...(await geocode(query)));
    } catch (error) {
      console.warn("Place geocoding failed:", query, error);
    }

    // Avoid unnecessary rapid requests to public geocoders.
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const unique = [];

  for (const candidate of candidates) {
    const duplicate = unique.some(
      (item) =>
        distanceKm(
          item.position,
          candidate.position
        ) < 0.05
    );

    if (!duplicate) {
      unique.push(candidate);
    }
  }

  const destinationCountry = getCountry(
    destinationProperties
  );

  const ranked = unique
    .map((candidate) => {
      const properties = candidate.properties || {};
      const country = getCountry(properties);

      return {
        ...candidate,
        distance: distanceKm(
          candidate.position,
          destinationPosition
        ),
        countryMatches:
          Boolean(destinationCountry) &&
          country === destinationCountry,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  // Prefer a matching country when available; otherwise require
  // the candidate to be reasonably close to the destination.
  return (
    ranked.find(
      (item) =>
        item.countryMatches ||
        item.distance <= 150
    ) || null
  );
};

const getRoute = async (positions) => {
  if (!positions || positions.length < 2) {
    return [];
  }

  const coordinates = positions
    .map(([lat, lon]) => `${lon},${lat}`)
    .join(";");

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    "?overview=full&geometries=geojson";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("OSRM route request failed");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("No driving route found");
  }

  return data.routes[0].geometry.coordinates.map(
    ([lon, lat]) => [lat, lon]
  );
};

const TripMap = ({
  destination = "",
  startPoint = "",
  places = [],
  placesByDay = [],
}) => {
  const [selectedDay, setSelectedDay] = useState("all");

  const [destinationPosition, setDestinationPosition] =
    useState(null);

  const [destinationProperties, setDestinationProperties] =
    useState({});

  const [startPointPosition, setStartPointPosition] =
    useState(null);

  const [placePositions, setPlacePositions] = useState([]);
  const [routePositions, setRoutePositions] = useState([]);
  const [journeyLine, setJourneyLine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  const normalizedDays = useMemo(
    () =>
      (placesByDay || []).map((day, index) => ({
        number: String(day.number ?? index + 1),
        title: day.title || `Day ${day.number ?? index + 1}`,
        places: normalizePlaceList(day.places || []),
      })),
    [placesByDay]
  );

  const hasDayGroups = normalizedDays.some(
    (day) => day.places.length > 0
  );

  // Use the day-grouped data when available. The flat places prop
  // remains as a fallback for older TripMap callers.
  const activePlaces = useMemo(() => {
    if (selectedDay === "all" || !hasDayGroups) {
      return normalizePlaceList(places);
    }

    const day = normalizedDays.find(
      (item) => item.number === selectedDay
    );

    return day?.places || [];
  }, [
    selectedDay,
    hasDayGroups,
    normalizedDays,
    places,
  ]);

  const dayOptions = useMemo(
    () =>
      normalizedDays.filter(
        (day) => day.places.length > 0
      ),
    [normalizedDays]
  );

  // Reset the filter if a different itinerary no longer contains
  // the previously selected day.
  useEffect(() => {
    if (
      selectedDay !== "all" &&
      !dayOptions.some(
        (day) => day.number === selectedDay
      )
    ) {
      setSelectedDay("all");
    }
  }, [selectedDay, dayOptions]);

  useEffect(() => {
    let cancelled = false;

    const findLocations = async () => {
      if (!destination.trim()) {
        setLoading(false);
        setMapError(
          "Enter a destination to display the map."
        );
        setDestinationPosition(null);
        setPlacePositions([]);
        setRoutePositions([]);
        setJourneyLine([]);
        return;
      }

      setLoading(true);
      setMapError("");
      setDestinationPosition(null);
      setDestinationProperties({});
      setStartPointPosition(null);
      setPlacePositions([]);
      setRoutePositions([]);
      setJourneyLine([]);
      setRouteLoading(false);

      try {
        // 1. Resolve the destination.
        const destinationResults = await geocode(destination);

        if (!destinationResults.length) {
          throw new Error(
            "Destination could not be found."
          );
        }

        const destinationResult =
          destinationResults.find((item) => {
            const p = item.properties || {};
            return Boolean(
              p.city || p.country || p.state
            );
          }) || destinationResults[0];

        const destinationPos = destinationResult.position;
        const destinationProps =
          destinationResult.properties || {};

        if (cancelled) return;

        setDestinationPosition(destinationPos);
        setDestinationProperties(destinationProps);
        setLoading(false);

        // 2. Resolve the start point.
        let startPos = null;

        const normalizedStart = startPoint
          .trim()
          .toLowerCase();

        console.log(
          "SmartTrip start point:",
          JSON.stringify(startPoint)
        );

        console.log(
          "SmartTrip normalized start:",
          normalizedStart
        );

        const isHyderabad =
          /(^|[\s,.-])(hyderabad|hyd|secunderabad)(?=$|[\s,.-])/.test(
            normalizedStart
          );

        if (isHyderabad) {
          startPos = HYDERABAD;
        } else if (normalizedStart) {
          const startResults = await geocode(startPoint);

          if (startResults.length) {
            const requested = normalizedStart.split(/[,\s]+/)[0];

            const matching = startResults.find((item) => {
              const p = item.properties || {};

              const label = [
                p.name,
                p.city,
                p.town,
                p.village,
                p.state,
                p.display_name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

              return label.includes(requested);
            });

            startPos = (
              matching || startResults[0]
            ).position;
          }
        }

        if (cancelled) return;

        if (startPos) {
          setStartPointPosition(startPos);

          setJourneyLine(
            createCurvedJourneyLine(
              startPos,
              destinationPos
            )
          );
        }

        // 3. Locate only the currently selected set of places.
        // Full Trip uses the original flat places list.
        const uniquePlaces = normalizePlaceList(
          activePlaces
        ).slice(0, 8);

        const locatedPlaces = [];

        for (const place of uniquePlaces) {
          if (cancelled) return;

          try {
            const result =
              await geocodePlaceNearDestination(
                place,
                destination,
                destinationPos,
                destinationProps
              );

            if (result?.position && !cancelled) {
              locatedPlaces.push({
                name: place,
                position: result.position,
              });

              setPlacePositions([...locatedPlaces]);
            } else {
              console.warn(
                "SmartTrip could not safely locate itinerary place:",
                place
              );
            }
          } catch (error) {
            console.warn(
              "Could not locate itinerary place:",
              place,
              error
            );
          }

          await new Promise(
            (resolve) => setTimeout(resolve, 500)
          );
        }

        if (cancelled) return;

        // 4. Build road routes only around the itinerary
        // destination. The start point is excluded from OSRM.
        const localStops = [
          ...locatedPlaces.map(
            (place) => place.position
          ),
          destinationPos,
        ];

        const stopsAreLocal =
          localStops.length >= 2 &&
          localStops.every(
            (position) =>
              distanceKm(position, destinationPos) <= 150
          );

        if (stopsAreLocal) {
          setRouteLoading(true);

          try {
            const route = await getRoute(localStops);

            if (!cancelled) {
              setRoutePositions(route);
            }
          } catch (error) {
            console.warn(
              "Local driving route unavailable:",
              error
            );
          } finally {
            if (!cancelled) {
              setRouteLoading(false);
            }
          }
        }
      } catch (error) {
        console.error("Destination map error:", error);

        if (!cancelled) {
          setMapError(
            "Unable to find this destination on the map."
          );
          setLoading(false);
        }
      }
    };

    findLocations();

    return () => {
      cancelled = true;
    };
  }, [destination, startPoint, activePlaces]);

  if (loading) {
    return (
      <div className="trip-map-loading">
        📍 Finding your destination on the map...
      </div>
    );
  }

  if (mapError || !destinationPosition) {
    return (
      <div className="trip-map-error">
        🗺️ {mapError || "Destination location unavailable."}
      </div>
    );
  }

  const showFullTripJourney = selectedDay === "all";

  return (
    <div className="trip-map">
      {hasDayGroups && (
        <div
          className="trip-map-day-filter"
          role="group"
          aria-label="Filter map by trip day"
        >
          <button
            type="button"
            className={`trip-map-day-button ${
              selectedDay === "all" ? "active" : ""
            }`}
            aria-pressed={selectedDay === "all"}
            onClick={() => setSelectedDay("all")}
          >
            Full Trip
          </button>

          {dayOptions.map((day) => (
            <button
              key={day.number}
              type="button"
              className={`trip-map-day-button ${
                selectedDay === day.number ? "active" : ""
              }`}
              aria-pressed={selectedDay === day.number}
              onClick={() => setSelectedDay(day.number)}
            >
              Day {day.number}
            </button>
          ))}
        </div>
      )}

      {hasDayGroups && (
        <p className="trip-map-day-description">
          {selectedDay === "all"
            ? "Showing the overall journey and trip locations."
            : `Showing locations for Day ${selectedDay}.`}
        </p>
      )}

      <MapContainer
        center={destinationPosition}
        zoom={7}
        scrollWheelZoom
        style={{ height: "420px", width: "100%" }}
      >
        <FitMapView
          startPosition={startPointPosition}
          destinationPosition={destinationPosition}
          placePositions={placePositions}
          journeyLine={showFullTripJourney ? journeyLine : []}
        />

        <TileLayer
          attribution="Tiles &copy; Esri — Sources: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        />

        {startPointPosition && (
          <Marker
            position={startPointPosition}
            icon={markerIcon}
          >
            <Popup>
              <strong>
                🚩 {startPoint || "Starting point"}
              </strong>
              <br />
              SmartTrip starting point
            </Popup>
          </Marker>
        )}

        {placePositions.map((place, index) => (
          <Marker
            key={`${place.name}-${index}`}
            position={place.position}
            icon={markerIcon}
          >
            <Popup>
              <strong>📌 {place.name}</strong>
              <br />
              SmartTrip itinerary location
            </Popup>
          </Marker>
        ))}

        <Marker
          position={destinationPosition}
          icon={markerIcon}
        >
          <Popup>
            <strong>📍 {destination}</strong>
            <br />
            SmartTrip destination
          </Popup>
        </Marker>

        {showFullTripJourney && journeyLine.length > 1 && (
          <Polyline
            positions={journeyLine}
            pathOptions={{
              color: "#8b5cf6",
              weight: 3,
              opacity: 0.9,
              dashArray: "8 10",
            }}
          />
        )}

        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.9,
            }}
          />
        )}
      </MapContainer>

      {routeLoading && (
        <div className="trip-map-route-status">
          🛣️ Building local driving route...
        </div>
      )}

      {!routeLoading && routePositions.length > 1 && (
        <div className="trip-map-route-status">
          🛣️ Local driving route calculated
        </div>
      )}

      {showFullTripJourney && journeyLine.length > 1 && (
        <div className="trip-map-route-status">
          ✈️ Curved line indicates the overall journey, not an actual flight path.
        </div>
      )}
    </div>
  );
};

export default TripMap;