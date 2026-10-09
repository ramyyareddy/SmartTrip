import React, { useEffect, useState } from "react";
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

/* -----------------------------------------
   FIT MAP TO ALL LOCATIONS
------------------------------------------ */

const FitMapView = ({
  startPosition,
  destinationPosition,
  placePositions,
}) => {
  const map = useMap();

  useEffect(() => {
    const allPositions = [
      ...(startPosition ? [startPosition] : []),

      ...(placePositions || []).map(
        (place) => place.position
      ),

      ...(destinationPosition
        ? [destinationPosition]
        : []),
    ];

    if (allPositions.length > 1) {
      const bounds = L.latLngBounds(allPositions);

      map.fitBounds(bounds, {
        padding: [50, 50],
      });

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    } else if (destinationPosition) {
      map.setView(destinationPosition, 12);

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  }, [
    startPosition,
    destinationPosition,
    placePositions,
    map,
  ]);

  return null;
};

/* -----------------------------------------
   PHOTON GEOCODING
------------------------------------------ */

const geocodePhoton = async (query) => {
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query
    )}&limit=5`
  );

  if (!response.ok) {
    throw new Error("Photon request failed");
  }

  const data = await response.json();

  if (
    !data.features ||
    !data.features.length
  ) {
    return [];
  }

  return data.features
    .map((feature) => {
      const coordinates =
        feature.geometry?.coordinates;

      if (
        !coordinates ||
        coordinates.length < 2
      ) {
        return null;
      }

      return {
        position: [
          Number(coordinates[1]),
          Number(coordinates[0]),
        ],
        properties:
          feature.properties || {},
      };
    })
    .filter(Boolean);
};

/* -----------------------------------------
   NOMINATIM FALLBACK
------------------------------------------ */

const geocodeNominatim = async (query) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
      query
    )}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      "Nominatim request failed"
    );
  }

  const data = await response.json();

  if (!data || !data.length) {
    return [];
  }

  return data
    .map((item) => {
      if (!item.lat || !item.lon) {
        return null;
      }

      return {
        position: [
          Number(item.lat),
          Number(item.lon),
        ],
        properties: item,
      };
    })
    .filter(Boolean);
};

/* -----------------------------------------
   BASIC GEOCODER
------------------------------------------ */

const geocode = async (query) => {
  try {
    const photonResults =
      await geocodePhoton(query);

    if (photonResults.length) {
      return photonResults;
    }
  } catch (error) {
    console.warn(
      "Photon failed:",
      query,
      error
    );
  }

  try {
    const nominatimResults =
      await geocodeNominatim(query);

    if (nominatimResults.length) {
      return nominatimResults;
    }
  } catch (error) {
    console.warn(
      "Nominatim failed:",
      query,
      error
    );
  }

  return [];
};

/* -----------------------------------------
   DISTANCE BETWEEN TWO COORDINATES
   HAVERSINE FORMULA
------------------------------------------ */

const distanceKm = (
  positionA,
  positionB
) => {
  if (!positionA || !positionB) {
    return Infinity;
  }

  const [lat1, lon1] = positionA;
  const [lat2, lon2] = positionB;

  const earthRadiusKm = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
};

/* -----------------------------------------
   DESTINATION-AWARE PLACE GEOCODING

   IMPORTANT:
   We do NOT accept a place simply because
   the name exists somewhere in the world.

   The result must be reasonably close to
   the selected destination.
------------------------------------------ */

const geocodePlaceNearDestination = async (
  place,
  destination,
  destinationPosition
) => {
  if (
    !place ||
    !destination ||
    !destinationPosition
  ) {
    return null;
  }

  const queries = [
    `${place}, ${destination}`,
    `${place}, ${destination}, India`,
  ];

  const candidates = [];

  for (const query of queries) {
    try {
      const results =
        await geocode(query);

      candidates.push(...results);
    } catch (error) {
      console.warn(
        "Place query failed:",
        query,
        error
      );
    }
  }

  if (!candidates.length) {
    return null;
  }

  /*
   * Remove duplicate coordinates.
   */
  const uniqueCandidates = [];

  for (const candidate of candidates) {
    const alreadyExists =
      uniqueCandidates.some(
        (existing) =>
          Math.abs(
            existing.position[0] -
              candidate.position[0]
          ) < 0.0001 &&
          Math.abs(
            existing.position[1] -
              candidate.position[1]
          ) < 0.0001
      );

    if (!alreadyExists) {
      uniqueCandidates.push(candidate);
    }
  }

  /*
   * Calculate distance from destination.
   */
  const candidatesWithDistance =
    uniqueCandidates.map(
      (candidate) => ({
        ...candidate,
        distance: distanceKm(
          candidate.position,
          destinationPosition
        ),
      })
    );

  candidatesWithDistance.sort(
    (a, b) =>
      a.distance - b.distance
  );

  /*
   * Only accept places reasonably close
   * to the selected destination.
   *
   * This prevents a place name from being
   * accidentally resolved to another country.
   */
  const MAX_PLACE_DISTANCE_KM = 150;

  const validCandidate =
    candidatesWithDistance.find(
      (candidate) =>
        candidate.distance <=
        MAX_PLACE_DISTANCE_KM
    );

  if (!validCandidate) {
    console.warn(
      "SmartTrip rejected place because it is too far from destination:",
      place,
      candidatesWithDistance.map(
        (candidate) => ({
          distanceKm:
            Math.round(
              candidate.distance
            ),
          position:
            candidate.position,
        })
      )
    );

    return null;
  }

  return validCandidate;
};

/* -----------------------------------------
   OSRM ROUTE
------------------------------------------ */

const getRoute = async (positions) => {
  if (
    !positions ||
    positions.length < 2
  ) {
    return [];
  }

  const coordinates = positions
    .map(
      ([lat, lon]) =>
        `${lon},${lat}`
    )
    .join(";");

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${coordinates}` +
    `?overview=full&geometries=geojson`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      "OSRM route request failed"
    );
  }

  const data =
    await response.json();

  if (
    data.code !== "Ok" ||
    !data.routes ||
    !data.routes.length
  ) {
    throw new Error(
      "No route found"
    );
  }

  const coordinatesFromRoute =
    data.routes[0].geometry
      .coordinates;

  return coordinatesFromRoute.map(
    ([lon, lat]) => [
      lat,
      lon,
    ]
  );
};

/* -----------------------------------------
   TRIP MAP
------------------------------------------ */

const TripMap = ({
  destination = "",
  startPoint = "",
  places = [],
}) => {
  const [
    destinationPosition,
    setDestinationPosition,
  ] = useState(null);

  const [
    startPointPosition,
    setStartPointPosition,
  ] = useState(null);

  const [
    placePositions,
    setPlacePositions,
  ] = useState([]);

  const [
    routePositions,
    setRoutePositions,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    mapError,
    setMapError,
  ] = useState("");

  const [
    routeLoading,
    setRouteLoading,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const findLocations = async () => {
      if (!destination.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setMapError("");

      setDestinationPosition(null);
      setStartPointPosition(null);
      setPlacePositions([]);
      setRoutePositions([]);

      try {
        /* --------------------------------
           1. DESTINATION
        -------------------------------- */

        const destinationResults =
          await geocode(
            destination
          );

        if (
          !destinationResults.length
        ) {
          throw new Error(
            "Destination could not be found."
          );
        }

        /*
         * Use the first destination result.
         */
        const destinationPositionData =
          destinationResults[0]
            .position;

        if (cancelled) return;

        setDestinationPosition(
          destinationPositionData
        );

        /*
         * Show map immediately.
         */
        setLoading(false);

        /* --------------------------------
           2. START POINT
        -------------------------------- */

        let startPosition = null;

        if (startPoint.trim()) {
          try {
            const startResults =
              await geocode(
                startPoint
              );

            if (
              startResults.length
            ) {
              startPosition =
                startResults[0]
                  .position;

              if (!cancelled) {
                setStartPointPosition(
                  startPosition
                );
              }
            }
          } catch (error) {
            console.warn(
              "Could not locate start point:",
              startPoint,
              error
            );
          }
        }

        /* --------------------------------
           3. NORMALIZE PLACES
        -------------------------------- */

        const cleanMapPlace = (
          place
        ) => {
          return String(place || "")
            // Remove descriptive text in parentheses.
            // Example:
            // "Bawarchi (local biryani)"
            // becomes "Bawarchi"
            .replace(
              /\s*\([^)]*\)\s*/g,
              ""
            )
            // Remove surrounding quotation marks.
            .replace(
              /^["“”']+|["“”']+$/g,
              ""
            )
            .trim();
        };

        const normalizedPlaces =
          places
            .map((place) => {
              let rawPlace = "";

              if (
                typeof place ===
                "string"
              ) {
                rawPlace = place;
              }

              if (
                place &&
                typeof place ===
                  "object"
              ) {
                rawPlace =
                  place.name ||
                  place.place ||
                  place.title ||
                  "";
              }

              return cleanMapPlace(
                rawPlace
              );
            })
            .filter(Boolean);

        /*
         * Remove duplicates.
         */
        const uniquePlaces = [
          ...new Set(
            normalizedPlaces
          ),
        ].slice(0, 8);

        console.log(
          "SmartTrip map places:",
          uniquePlaces
        );

        /* --------------------------------
           4. GEOCODE ITINERARY PLACES
        -------------------------------- */

        const locatedPlaces = [];

        for (
          const place of uniquePlaces
        ) {
          if (cancelled) {
            return;
          }

          let placeResult = null;

          try {
            placeResult =
              await geocodePlaceNearDestination(
                place,
                destination,
                destinationPositionData
              );
          } catch (error) {
            console.warn(
              "Place geocoding failed:",
              place,
              error
            );
          }

          if (
            placeResult &&
            placeResult.position &&
            !cancelled
          ) {
            const newPlace = {
              name: place,
              position:
                placeResult.position,
            };

            locatedPlaces.push(
              newPlace
            );

            /*
             * Display marker immediately.
             */
            setPlacePositions([
              ...locatedPlaces,
            ]);

            console.log(
              "SmartTrip place found:",
              place,
              placeResult.position,
              `Distance from destination: ${Math.round(
                placeResult.distance
              )} km`
            );
          } else {
            console.warn(
              "SmartTrip could not safely locate:",
              place
            );
          }

          /*
           * Give the public geocoders
           * a small breathing interval.
           */
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                800
              )
          );
        }

        if (cancelled) {
          return;
        }

        /* --------------------------------
           5. BUILD JOURNEY STOPS
        -------------------------------- */

        const routeStops = [
          ...(startPosition
            ? [startPosition]
            : []),

          ...locatedPlaces.map(
            (place) =>
              place.position
          ),

          destinationPositionData,
        ];

        console.log(
          "SmartTrip route stops:",
          routeStops
        );

        /* --------------------------------
           6. BUILD ROAD ROUTE
        -------------------------------- */

        if (
          routeStops.length >= 2
        ) {
          try {
            setRouteLoading(true);

            const route =
              await getRoute(
                routeStops
              );

            if (!cancelled) {
              setRoutePositions(
                route
              );
            }
          } catch (error) {
            console.warn(
              "Could not build complete route:",
              error
            );

            /*
             * If the multi-stop route
             * fails, fall back to
             * start → destination.
             */
            if (startPosition) {
              try {
                const fallbackRoute =
                  await getRoute([
                    startPosition,
                    destinationPositionData,
                  ]);

                if (!cancelled) {
                  setRoutePositions(
                    fallbackRoute
                  );
                }
              } catch (
                fallbackError
              ) {
                console.warn(
                  "Fallback route failed:",
                  fallbackError
                );
              }
            }
          } finally {
            if (!cancelled) {
              setRouteLoading(
                false
              );
            }
          }
        }
      } catch (error) {
        console.error(
          "Destination map error:",
          error
        );

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
  }, [
    destination,
    startPoint,
    places,
  ]);

  /* -----------------------------------------
     LOADING
  ------------------------------------------ */

  if (loading) {
    return (
      <div className="trip-map-loading">
        📍 Finding your destination on the map...
      </div>
    );
  }

  /* -----------------------------------------
     ERROR
  ------------------------------------------ */

  if (
    mapError ||
    !destinationPosition
  ) {
    return (
      <div className="trip-map-error">
        🗺️{" "}
        {mapError ||
          "Destination location unavailable."}
      </div>
    );
  }

  /* -----------------------------------------
     MAP
  ------------------------------------------ */

  return (
    <div className="trip-map">
      <MapContainer
        center={
          destinationPosition
        }
        zoom={7}
        scrollWheelZoom={true}
        style={{
          height: "420px",
          width: "100%",
        }}
      >
        <FitMapView
          startPosition={
            startPointPosition
          }
          destinationPosition={
            destinationPosition
          }
          placePositions={
            placePositions
          }
        />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* --------------------------------
            START POINT
        --------------------------------- */}

        {startPointPosition && (
          <Marker
            position={
              startPointPosition
            }
            icon={markerIcon}
          >
            <Popup>
              <strong>
                🚩 {startPoint}
              </strong>

              <br />

              SmartTrip starting point
            </Popup>
          </Marker>
        )}

        {/* --------------------------------
            ITINERARY PLACES
        --------------------------------- */}

        {placePositions.map(
          (place, index) => (
            <Marker
              key={`${place.name}-${index}`}
              position={
                place.position
              }
              icon={markerIcon}
            >
              <Popup>
                <strong>
                  📌 {place.name}
                </strong>

                <br />

                SmartTrip itinerary location
              </Popup>
            </Marker>
          )
        )}

        {/* --------------------------------
            DESTINATION
        --------------------------------- */}

        <Marker
          position={
            destinationPosition
          }
          icon={markerIcon}
        >
          <Popup>
            <strong>
              📍 {destination}
            </strong>

            <br />

            SmartTrip destination
          </Popup>
        </Marker>

        {/* --------------------------------
            JOURNEY ROUTE
        --------------------------------- */}

        {routePositions.length > 1 && (
          <Polyline
            positions={
              routePositions
            }
            pathOptions={{
              color: "#6366f1",
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}
      </MapContainer>

      {/* --------------------------------
          ROUTE STATUS
      -------------------------------- */}

      {routeLoading && (
        <div className="trip-map-route-status">
          🛣️ Building your journey route...
        </div>
      )}

      {!routeLoading &&
        routePositions.length > 1 && (
          <div className="trip-map-route-status">
            🛣️ Journey route calculated
          </div>
        )}
    </div>
  );
};

export default TripMap;