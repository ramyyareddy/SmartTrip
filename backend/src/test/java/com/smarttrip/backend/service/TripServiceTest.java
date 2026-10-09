package com.smarttrip.backend.service;

import com.smarttrip.backend.model.Trip;
import com.smarttrip.backend.model.User;
import com.smarttrip.backend.repository.TripRepository;
import com.smarttrip.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private UserRepository userRepository;

    private TripService tripService;
    private User testUser;

    @BeforeEach
    void setUp() {
        tripService = new TripService(tripRepository, userRepository);
        testUser = new User("Alice", "alice@example.com", "password123");
        testUser.setId(1L);
    }

    @Test
    @DisplayName("Create trip persists custom currency")
    void testCreateTripWithCurrency() {
        Trip trip = new Trip("Kyoto", LocalDate.now(), LocalDate.now().plusDays(5), 2500.0, "Temples");
        trip.setCurrency("JPY");

        when(userRepository.findByEmail("alice@example.com")).thenReturn(testUser);
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Trip saved = tripService.createTrip(trip, "alice@example.com");

        assertNotNull(saved);
        assertEquals("JPY", saved.getCurrency());
        assertEquals("alice@example.com", saved.getUser().getEmail());
    }

    @Test
    @DisplayName("Create trip defaults to INR if currency is null or blank")
    void testCreateTripDefaultCurrency() {
        Trip trip = new Trip("Goa", LocalDate.now(), LocalDate.now().plusDays(3), 15000.0, "Beaches");
        trip.setCurrency(null);

        when(userRepository.findByEmail("alice@example.com")).thenReturn(testUser);
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Trip saved = tripService.createTrip(trip, "alice@example.com");

        assertNotNull(saved);
        assertEquals("INR", saved.getCurrency());
    }

    @Test
    @DisplayName("Get my trips defaults any existing null currency to INR")
    void testGetMyTripsDefaultsNullCurrency() {
        Trip trip1 = new Trip("Mumbai", LocalDate.now(), LocalDate.now().plusDays(2), 10000.0, "Food");
        trip1.setCurrency(null);
        Trip trip2 = new Trip("London", LocalDate.now(), LocalDate.now().plusDays(4), 1500.0, "Museums");
        trip2.setCurrency("GBP");

        when(tripRepository.findByUserEmail("alice@example.com")).thenReturn(List.of(trip1, trip2));

        List<Trip> trips = tripService.getMyTrips("alice@example.com");

        assertEquals(2, trips.size());
        assertEquals("INR", trips.get(0).getCurrency(), "Legacy trip with null currency should default to INR");
        assertEquals("GBP", trips.get(1).getCurrency(), "Trip with GBP currency should remain GBP");
    }

    @Test
    @DisplayName("Update trip preserves omitted fields in partial update")
    void testUpdateTripPreservesOmittedFields() {
        Trip existingTrip = new Trip("Paris", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7), 2000.0, "Art");
        existingTrip.setId(10L);
        existingTrip.setItinerary("Original Itinerary");
        existingTrip.setCurrency("EUR");

        when(tripRepository.findByIdAndUserEmail(10L, "alice@example.com")).thenReturn(existingTrip);
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Partial update: only updates budget and currency, leaves destination, dates, itinerary intact
        Trip partialUpdate = new Trip();
        partialUpdate.setBudget(2500.0);
        partialUpdate.setCurrency("USD");

        Trip updated = tripService.updateTrip(10L, partialUpdate, "alice@example.com");

        assertNotNull(updated);
        assertEquals("Paris", updated.getDestination(), "Destination should be preserved");
        assertEquals(LocalDate.of(2026, 6, 1), updated.getStartDate(), "Start date should be preserved");
        assertEquals("Original Itinerary", updated.getItinerary(), "Itinerary should be preserved");
        assertEquals(2500.0, updated.getBudget(), "Budget should be updated");
        assertEquals("USD", updated.getCurrency(), "Currency should be updated");
    }

    @Test
    @DisplayName("Update trip returns null when unauthorized or not found")
    void testUpdateTripNotFound() {
        when(tripRepository.findByIdAndUserEmail(999L, "alice@example.com")).thenReturn(null);

        Trip trip = new Trip();
        trip.setDestination("New York");

        Trip result = tripService.updateTrip(999L, trip, "alice@example.com");
        assertNull(result, "Updating non-existent trip should return null");
    }

    @Test
    @DisplayName("Delete trip returns true when owned, false when unauthorized")
    void testDeleteTrip() {
        Trip existing = new Trip();
        existing.setId(5L);

        when(tripRepository.findByIdAndUserEmail(5L, "alice@example.com")).thenReturn(existing);
        when(tripRepository.findByIdAndUserEmail(99L, "alice@example.com")).thenReturn(null);

        assertTrue(tripService.deleteTrip(5L, "alice@example.com"));
        verify(tripRepository, times(1)).delete(existing);

        assertFalse(tripService.deleteTrip(99L, "alice@example.com"));
    }
}
