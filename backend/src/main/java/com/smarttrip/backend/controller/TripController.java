package com.smarttrip.backend.controller;

import com.smarttrip.backend.model.Trip;
import com.smarttrip.backend.service.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trips")
@CrossOrigin(origins = "*")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @PostMapping
    public ResponseEntity<?> createTrip(
            @RequestBody(required = false) Trip trip,
            Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated.");
        }

        if (trip == null || trip.getDestination() == null || trip.getDestination().isBlank()) {
            return ResponseEntity.badRequest().body("Destination is required to save a trip.");
        }

        String email = authentication.getName();
        Trip saved = tripService.createTrip(trip, email);

        if (saved == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User account not found.");
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    public ResponseEntity<List<Trip>> getMyTrips(Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        return ResponseEntity.ok(tripService.getMyTrips(email));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getMyTripById(
            @PathVariable Long id,
            Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        Trip trip = tripService.getMyTripById(id, email);

        if (trip == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Trip not found or access denied.");
        }

        return ResponseEntity.ok(trip);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTrip(
            @PathVariable Long id,
            @RequestBody(required = false) Trip trip,
            Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (trip == null) {
            return ResponseEntity.badRequest().body("Trip update payload cannot be empty.");
        }

        String email = authentication.getName();
        Trip updated = tripService.updateTrip(id, trip, email);

        if (updated == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Trip not found or update denied.");
        }

        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteTrip(
            @PathVariable Long id,
            Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated.");
        }

        String email = authentication.getName();
        boolean deleted = tripService.deleteTrip(id, email);

        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Trip not found or you do not have permission to delete it.");
        }

        return ResponseEntity.ok("Trip deleted successfully.");
    }
}