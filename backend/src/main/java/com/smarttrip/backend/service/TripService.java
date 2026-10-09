package com.smarttrip.backend.service;

import com.smarttrip.backend.model.Trip;
import com.smarttrip.backend.model.User;
import com.smarttrip.backend.repository.TripRepository;
import com.smarttrip.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final UserRepository userRepository;

    public TripService(TripRepository tripRepository,
                       UserRepository userRepository) {
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
    }

    public Trip createTrip(Trip trip, String email) {
        if (trip == null || email == null || email.isBlank()) {
            return null;
        }

        User user = userRepository.findByEmail(email);

        if (user == null) {
            return null;
        }

        trip.setUser(user);
        if (trip.getCurrency() == null || trip.getCurrency().isBlank()) {
            trip.setCurrency("INR");
        }

        return tripRepository.save(trip);
    }

    public List<Trip> getMyTrips(String email) {
        if (email == null || email.isBlank()) {
            return List.of();
        }
        List<Trip> trips = tripRepository.findByUserEmail(email);
        for (Trip trip : trips) {
            if (trip.getCurrency() == null || trip.getCurrency().isBlank()) {
                trip.setCurrency("INR");
            }
        }
        return trips;
    }

    public Trip getMyTripById(Long id, String email) {
        if (id == null || email == null || email.isBlank()) {
            return null;
        }
        Trip trip = tripRepository.findByIdAndUserEmail(id, email);
        if (trip != null && (trip.getCurrency() == null || trip.getCurrency().isBlank())) {
            trip.setCurrency("INR");
        }
        return trip;
    }

    public Trip updateTrip(Long id, Trip trip, String email) {
        if (id == null || trip == null || email == null || email.isBlank()) {
            return null;
        }

        Trip existingTrip =
                tripRepository.findByIdAndUserEmail(id, email);

        if (existingTrip == null) {
            return null;
        }

        if (trip.getDestination() != null && !trip.getDestination().isBlank()) {
            existingTrip.setDestination(trip.getDestination());
        }
        if (trip.getStartDate() != null) {
            existingTrip.setStartDate(trip.getStartDate());
        }
        if (trip.getEndDate() != null) {
            existingTrip.setEndDate(trip.getEndDate());
        }
        if (trip.getBudget() != null) {
            existingTrip.setBudget(trip.getBudget());
        }
        if (trip.getInterests() != null && !trip.getInterests().isBlank()) {
            existingTrip.setInterests(trip.getInterests());
        }
        if (trip.getItinerary() != null && !trip.getItinerary().isBlank()) {
            existingTrip.setItinerary(trip.getItinerary());
        }
        if (trip.getCurrency() != null && !trip.getCurrency().isBlank()) {
            existingTrip.setCurrency(trip.getCurrency());
        }

        return tripRepository.save(existingTrip);
    }

    public boolean deleteTrip(Long id, String email) {

        Trip existingTrip =
                tripRepository.findByIdAndUserEmail(id, email);

        if (existingTrip == null) {
            return false;
        }

        tripRepository.delete(existingTrip);

        return true;
    }
}