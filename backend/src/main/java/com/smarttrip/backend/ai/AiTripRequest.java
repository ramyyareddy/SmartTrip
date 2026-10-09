
package com.smarttrip.backend.ai;

public class AiTripRequest {

    private String destination;
    private int days;
    private Double budget;
    private String interests;
    private String currency;

    public AiTripRequest() {
    }

    public AiTripRequest(String destination, int days, Double budget, String interests) {
        this.destination = destination;
        this.days = days;
        this.budget = budget;
        this.interests = interests;
        this.currency = "INR";
    }

    public AiTripRequest(String destination, int days, Double budget, String interests, String currency) {
        this.destination = destination;
        this.days = days;
        this.budget = budget;
        this.interests = interests;
        this.currency = currency;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public int getDays() {
        return days;
    }

    public void setDays(int days) {
        this.days = days;
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

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}