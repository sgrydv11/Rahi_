package com.hoopr.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebAppRoutes implements WebMvcConfigurer {
    public static final String[] PAGES = {"/", "/help", "/chat", "/login", "/register", "/profile", "/vehicles", "/notifications",
            "/rides", "/rides/mine", "/rides/new", "/rides/{id}", "/rides/{id}/edit", "/rides/{id}/bookings",
            "/bookings/mine", "/bookings/{id}"};
    public static final String[] ASSETS = {"/index.html", "/assets/**", "/fonts/**", "/icons/**", "/flexirrides-icon.png", "/favicon.png"};

    public static boolean browserPage(jakarta.servlet.http.HttpServletRequest request) {
        String path=request.getRequestURI().substring(request.getContextPath().length());
        String accept=request.getHeader("Accept");
        return ("GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()))
            && accept!=null && accept.contains("text/html")
            && !path.startsWith("/api") && !path.startsWith("/actuator") && !path.startsWith("/assets");
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        for (String path : PAGES) registry.addViewController(path).setViewName("forward:/index.html");
    }
}
