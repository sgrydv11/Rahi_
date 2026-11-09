package com.hoopr.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebAppRoutes implements WebMvcConfigurer {
    public static final String[] PAGES = {"/", "/login", "/register", "/profile", "/vehicles", "/notifications",
            "/rides", "/rides/mine", "/rides/new", "/rides/{id}", "/rides/{id}/edit", "/rides/{id}/bookings",
            "/bookings/mine", "/bookings/{id}"};
    public static final String[] ASSETS = {"/index.html", "/assets/**", "/flexirrides-icon.png"};

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        for (String path : PAGES) registry.addViewController(path).setViewName("forward:/index.html");
    }
}
