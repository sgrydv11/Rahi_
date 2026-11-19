package com.hoopr.vehicle;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1")
public class DriverVerificationController {
 private final DriverVerificationService service;
 public DriverVerificationController(DriverVerificationService service){this.service=service;}
 private UUID actor(Jwt j){return UUID.fromString(j.getSubject());}
 @GetMapping("/vehicles/{id}/verification") public DriverVerificationService.View mine(@AuthenticationPrincipal Jwt j,@PathVariable UUID id){return service.mine(actor(j),id);}
 @PutMapping("/vehicles/{id}/verification") public DriverVerificationService.View save(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@RequestBody DriverVerificationService.Input b){return service.save(actor(j),id,b);}
 public record Upload(@NotBlank @Size(max=2796204) String content){}
 @PutMapping("/vehicles/{id}/verification/documents/{kind}") public DriverVerificationService.View upload(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@PathVariable String kind,@Valid @RequestBody Upload b){return service.upload(actor(j),id,kind,b.content());}
 @PostMapping("/vehicles/{id}/verification/submit") public DriverVerificationService.View submit(@AuthenticationPrincipal Jwt j,@PathVariable UUID id){return service.submit(actor(j),id);}
 @PreAuthorize("hasRole('ADMIN')") @GetMapping("/admin/driver-verifications") public List<Map<String,Object>> queue(@AuthenticationPrincipal Jwt j){return service.queue(actor(j));}
 @PreAuthorize("hasRole('ADMIN')") @GetMapping("/admin/driver-verifications/{id}") public DriverVerificationService.View details(@AuthenticationPrincipal Jwt j,@PathVariable UUID id){return service.reviewDetails(actor(j),id);}
 public record Review(@NotNull @Pattern(regexp="APPROVED|REJECTED") String decision,@Min(0) long revision,@NotBlank @Size(min=10,max=500) String reason){}
 @PreAuthorize("hasRole('ADMIN')") @PostMapping("/admin/driver-verifications/{id}/review") public DriverVerificationService.View review(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@Valid @RequestBody Review b){return service.review(actor(j),id,b.decision(),b.revision(),b.reason());}
 @GetMapping("/vehicles/{id}/verification/documents/{kind}") public ResponseEntity<byte[]> ownDocument(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@PathVariable String kind){return file(service.document(actor(j),id,kind,false));}
 @PreAuthorize("hasRole('ADMIN')") @GetMapping("/admin/driver-verifications/{id}/documents/{kind}") public ResponseEntity<byte[]> adminDocument(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@PathVariable String kind){return file(service.document(actor(j),id,kind,true));}
 @PreAuthorize("hasRole('ADMIN')") @GetMapping("/admin/driver-verifications/{id}/documents/{kind}/content") public DriverVerificationService.Document documentContent(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@PathVariable String kind){return service.document(actor(j),id,kind,true);}
 private ResponseEntity<byte[]> file(DriverVerificationService.Document d){return ResponseEntity.ok().contentType(MediaType.parseMediaType(d.mediaType())).header("Content-Disposition","attachment; filename=verification-document"+switch(d.mediaType()){case "application/pdf"->".pdf";case "image/png"->".png";default->".jpg";}).header("Cache-Control","no-store").header("X-Content-Type-Options","nosniff").body(d.content());}
}
