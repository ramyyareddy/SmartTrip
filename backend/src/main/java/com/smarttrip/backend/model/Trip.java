package com.smarttrip.backend.model;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String destination;

    private LocalDate startDate;

    private LocalDate endDate;

    private Double budget;

    private String interests;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String itinerary;

    @Column(name = "currency")
    private String currency = "INR";

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    public Trip() {
    }

    public Trip(String destination,
                LocalDate startDate,
                LocalDate endDate,
                Double budget,
                String interests) {

        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budget = budget;
        this.interests = interests;
        this.currency = "INR";
    }

    public Trip(String destination,
                LocalDate startDate,
                LocalDate endDate,
                Double budget,
                String interests,
                String currency) {

        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budget = budget;
        this.interests = interests;
        this.currency = (currency == null || currency.isBlank()) ? "INR" : currency;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public Double getBudget() {
        return budget;
    }

    public void setBudget(Double budget) {
        this.budget = budget;
    }

    public String getInterests() {
        return interests;
    }

    public void setInterests(String interests) {
        this.interests = interests;
    }

    public String getItinerary() {
        return itinerary;
    }

    public void setItinerary(String itinerary) {
        this.itinerary = itinerary;
    }

    public String getCurrency() {
        return (currency == null || currency.isBlank()) ? "INR" : currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}