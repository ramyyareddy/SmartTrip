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

        User user = userRepository.findByEmail(email);

        if (user == null) {
            return null;
        }

        trip.setUser(user);

        return tripRepository.save(trip);
    }

    public List<Trip> getMyTrips(String email) {
        return tripRepository.findByUserEmail(email);
    }

    public Trip getMyTripById(Long id, String email) {
        return tripRepository.findByIdAndUserEmail(id, email);
    }

    public Trip updateTrip(Long id, Trip trip, String email) {

        Trip existingTrip =
                tripRepository.findByIdAndUserEmail(id, email);

        if (existingTrip == null) {
            return null;
        }

        existingTrip.setDestination(trip.getDestination());
        existingTrip.setStartDate(trip.getStartDate());
        existingTrip.setEndDate(trip.getEndDate());
        existingTrip.setBudget(trip.getBudget());
        existingTrip.setInterests(trip.getInterests());
        existingTrip.setItinerary(trip.getItinerary());

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