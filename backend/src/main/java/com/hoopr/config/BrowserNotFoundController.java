package com.hoopr.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.ModelAndView;

/** Render the SPA's recovery screen for unknown HTML pages, preserving HTTP 404. */
@ControllerAdvice
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class BrowserNotFoundController {
    @ExceptionHandler(NoResourceFoundException.class)
    public ModelAndView missing(NoResourceFoundException failure, HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) {
        if(!WebAppRoutes.browserPage(request)){response.setStatus(404);return null;}
        var view=new ModelAndView("forward:/index.html");
        view.setStatus(HttpStatus.NOT_FOUND);
        return view;
    }
}
