package com.smarttrip.backend.controller;

import com.smarttrip.backend.model.Trip;
import com.smarttrip.backend.service.TripService;
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
    public Trip createTrip(
            @RequestBody Trip trip,
            Authentication authentication) {

        String email = authentication.getName();

        return tripService.createTrip(trip, email);
    }

    @GetMapping
    public List<Trip> getMyTrips(Authentication authentication) {

        String email = authentication.getName();

        return tripService.getMyTrips(email);
    }

    @GetMapping("/{id}")
    public Trip getMyTripById(
            @PathVariable Long id,
            Authentication authentication) {

        String email = authentication.getName();

        return tripService.getMyTripById(id, email);
    }

    @PutMapping("/{id}")
    public Trip updateTrip(
            @PathVariable Long id,
            @RequestBody Trip trip,
            Authentication authentication) {

        String email = authentication.getName();

        return tripService.updateTrip(id, trip, email);
    }

    @DeleteMapping("/{id}")
    public String deleteTrip(
            @PathVariable Long id,
            Authentication authentication) {

        String email = authentication.getName();

        boolean deleted = tripService.deleteTrip(id, email);

        if (!deleted) {
            return "Trip not found or you do not have permission to delete it";
        }

        return "Trip deleted successfully";
    }
}