package com.charging.backend.controller;

import com.charging.backend.common.ApiResult;
import com.charging.backend.service.GenericCrudService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping
public class GenericCrudController {

    private final GenericCrudService crudService;

    public GenericCrudController(GenericCrudService crudService) {
        this.crudService = crudService;
    }

    @GetMapping("/{module}/{resource}/list")
    public Map<String, Object> list(
        @PathVariable String module,
        @PathVariable String resource,
        @RequestParam Map<String, String> query
    ) {
        GenericCrudService.QueryResult result = crudService.list(module, resource, query);
        return ApiResult.table(result.rows(), result.total());
    }

    @GetMapping("/{module}/{resource}/{id}")
    public Map<String, Object> get(
        @PathVariable String module,
        @PathVariable String resource,
        @PathVariable String id
    ) {
        Map<String, Object> data = crudService.getById(module, resource, id);
        return ApiResult.successData(data);
    }

    @PostMapping("/{module}/{resource}")
    public Map<String, Object> create(
        @PathVariable String module,
        @PathVariable String resource,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        Map<String, Object> created = crudService.create(module, resource, body == null ? Collections.emptyMap() : body);
        return ApiResult.successData(created);
    }

    @PutMapping("/{module}/{resource}")
    public Map<String, Object> update(
        @PathVariable String module,
        @PathVariable String resource,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        Map<String, Object> updated = crudService.update(module, resource, null, body == null ? Collections.emptyMap() : body);
        return ApiResult.successData(updated);
    }

    @PutMapping("/{module}/{resource}/{id}")
    public Map<String, Object> updateByPath(
        @PathVariable String module,
        @PathVariable String resource,
        @PathVariable String id,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        Map<String, Object> updated = crudService.update(module, resource, id, body == null ? Collections.emptyMap() : body);
        return ApiResult.successData(updated);
    }

    @DeleteMapping("/{module}/{resource}/{ids}")
    public Map<String, Object> delete(
        @PathVariable String module,
        @PathVariable String resource,
        @PathVariable String ids
    ) {
        int affected = crudService.delete(module, resource, ids);
        return ApiResult.successData(Map.of("affected", affected));
    }
}

