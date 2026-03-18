package com.charging.backend.service;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Component
public class ResourceRegistry {

    private final Map<String, String> routeToTable = new LinkedHashMap<>();

    public ResourceRegistry() {
        register("breaks/answer", "answer");
        register("breaks/breakdown", "breakdown");
        register("breaks/breaktype", "breaktype");
        register("breaks/question", "question");

        register("car/carbrand", "carbrand");
        register("car/carinfo", "carinfo");
        register("car/carmodel", "carmodel");

        register("chargingstation/chongdianzhan", "chargingstation");
        register("chargingstation/opentime", "opentime");
        register("chargingstation/order", "order");
        register("chargingstation/power", "power");
        register("chargingstation/stationgrade", "stationgrade");
        register("chargingstation/stationservice", "stationservice");
        register("chargingstation/stump", "stump");

        register("member/bankcard", "bankcard");
        register("member/outlay", "outlay");
        register("member/topup", "topup");
        register("member/user", "user");
        register("member/userinfo", "user");
        register("member/usercar", "usercar");

        register("sc/collect", "collect");
        register("sc/searchrecord", "searchrecord");

        register("staff/staff", "staff");
        register("staff/stafftype", "stafftype");
        register("stafftype/stafftype", "stafftype");
        register("mapper/stump", "stump");
    }

    public Optional<String> resolveTable(String module, String resource) {
        String key = normalizeKey(module, resource);
        return Optional.ofNullable(routeToTable.get(key));
    }

    public boolean isRegistered(String module, String resource) {
        return resolveTable(module, resource).isPresent();
    }

    private void register(String routeKey, String tableName) {
        routeToTable.put(routeKey.toLowerCase(Locale.ROOT), tableName);
    }

    private String normalizeKey(String module, String resource) {
        return (module + "/" + resource).toLowerCase(Locale.ROOT);
    }
}

