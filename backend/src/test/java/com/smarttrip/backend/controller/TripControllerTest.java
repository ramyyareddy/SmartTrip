package com.smarttrip.backend.controller;

import com.smarttrip.backend.model.Trip;
import com.smarttrip.backend.service.TripService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripControllerTest {

    @Mock
    private TripService tripService;

    @Mock
    private Authentication authentication;

    private TripController tripController;

    @BeforeEach
    void setUp() {
        tripController = new TripController(tripService);
    }

    @Test
    @DisplayName("Create trip when authenticated persists and returns 201 Created")
    void testCreateTripAuthenticated() {
        when(authentication.getName()).thenReturn("bob@example.com");

        Trip input = new Trip();
        input.setDestination("Barcelona");
        input.setBudget(1800.0);
        input.setCurrency("EUR");

        Trip saved = new Trip();
        saved.setId(1L);
        saved.setDestination("Barcelona");
        saved.setBudget(1800.0);
        saved.setCurrency("EUR");

        when(tripService.createTrip(any(Trip.class), eq("bob@example.com"))).thenReturn(saved);

        ResponseEntity<?> response = tripController.createTrip(input, authentication);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertTrue(response.getBody() instanceof Trip);
        Trip body = (Trip) response.getBody();
        assertEquals("EUR", body.getCurrency());
    }

    @Test
    @DisplayName("Create trip unauthenticated returns 401 Unauthorized")
    void testCreateTripUnauthenticated() {
        Trip input = new Trip();
        input.setDestination("Barcelona");

        ResponseEntity<?> response = tripController.createTrip(input, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(tripService, never()).createTrip(any(), any());
    }

    @Test
    @DisplayName("Create trip with missing destination returns 400 Bad Request")
    void testCreateTripMissingDestination() {
        when(authentication.getName()).thenReturn("bob@example.com");

        Trip input = new Trip();
        input.setDestination(""); // empty

        ResponseEntity<?> response = tripController.createTrip(input, authentication);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(tripService, never()).createTrip(any(), any());
    }

    @Test
    @DisplayName("Get my trips returns 200 OK with list")
    void testGetMyTrips() {
        when(authentication.getName()).thenReturn("bob@example.com");
        Trip trip = new Trip();
        trip.setId(1L);
        trip.setDestination("Rome");
        when(tripService.getMyTrips("bob@example.com")).thenReturn(List.of(trip));

        ResponseEntity<List<Trip>> response = tripController.getMyTrips(authentication);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
    }

    @Test
    @DisplayName("Get my trips unauthenticated returns 401 Unauthorized")
    void testGetMyTripsUnauthenticated() {
        ResponseEntity<List<Trip>> response = tripController.getMyTrips(null);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Get trip by ID returns 404 when not found")
    void testGetTripByIdNotFound() {
        when(authentication.getName()).thenReturn("bob@example.com");
        when(tripService.getMyTripById(999L, "bob@example.com")).thenReturn(null);

        ResponseEntity<?> response = tripController.getMyTripById(999L, authentication);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("Delete trip returns 200 when deleted, 404 when not found or unauthorized")
    void testDeleteTrip() {
        when(authentication.getName()).thenReturn("bob@example.com");
        when(tripService.deleteTrip(1L, "bob@example.com")).thenReturn(true);
        when(tripService.deleteTrip(2L, "bob@example.com")).thenReturn(false);

        ResponseEntity<String> res1 = tripController.deleteTrip(1L, authentication);
        assertEquals(HttpStatus.OK, res1.getStatusCode());

        ResponseEntity<String> res2 = tripController.deleteTrip(2L, authentication);
        assertEquals(HttpStatus.NOT_FOUND, res2.getStatusCode());
    }
}
