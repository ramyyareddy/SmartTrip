package com.smarttrip.backend.controller;

import com.smarttrip.backend.dto.UserResponse;
import com.smarttrip.backend.model.User;
import com.smarttrip.backend.security.JwtService;
import com.smarttrip.backend.service.UserService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final JwtService jwtService;

    public UserController(UserService userService, JwtService jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public UserResponse register(@RequestBody User user) {

        User registeredUser = userService.registerUser(user);

        return new UserResponse(
                registeredUser.getId(),
                registeredUser.getName(),
                registeredUser.getEmail()
        );
    }

    @PostMapping("/login")
    public String login(@RequestBody User user) {

        User loggedInUser = userService.loginUser(
                user.getEmail(),
                user.getPassword()
        );

        return jwtService.generateToken(loggedInUser.getEmail());
    }
}