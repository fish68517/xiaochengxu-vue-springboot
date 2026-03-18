package com.charging.backend.controller;

import com.charging.backend.common.ApiResult;
import com.charging.backend.service.TokenService;
import com.charging.backend.support.AuthSession;
import com.charging.backend.support.NameUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping
public class AuthController {

    private static final String TINY_GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    private final TokenService tokenService;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final Map<String, EmailCode> emailCodeStore = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public AuthController(TokenService tokenService, JdbcTemplate jdbcTemplate) {
        this.tokenService = tokenService;
        this.jdbcTemplate = jdbcTemplate;
        this.namedJdbcTemplate = new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    @GetMapping("/captchaImage")
    public Map<String, Object> captchaImage() {
        Map<String, Object> result = ApiResult.successData(null);
        result.put("img", TINY_GIF_BASE64);
        result.put("uuid", UUID.randomUUID().toString());
        result.put("captchaEnabled", false);
        return result;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body) {
        String username = getString(body, "username");
        String password = getString(body, "password");

        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            return ApiResult.error("用户名或密码不能为空");
        }
        if (!"admin".equals(username) || !"admin123".equals(password)) {
            return ApiResult.error("用户名或密码错误");
        }

        String token = tokenService.createAdminToken(username);
        Map<String, Object> result = ApiResult.success("登录成功");
        result.put("token", token);
        return result;
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        tokenService.remove(authorization);
        return ApiResult.success("退出成功");
    }

    @GetMapping("/getInfo")
    public Map<String, Object> getInfo(@RequestHeader(value = "Authorization", required = false) String authorization) {
        Optional<AuthSession> sessionOpt = tokenService.resolve(authorization);
        if (sessionOpt.isEmpty()) {
            return ApiResult.unauthorized("未登录或登录已过期");
        }
        AuthSession session = sessionOpt.get();

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("userId", session.getUserId() == null ? 1 : session.getUserId());
        user.put("userName", session.getUserName());
        user.put("avatar", "");

        Map<String, Object> result = ApiResult.successData(null);
        result.put("user", user);
        if (session.isAdmin()) {
            result.put("roles", List.of("admin"));
            result.put("permissions", List.of("*:*:*"));
        } else {
            result.put("roles", List.of("common"));
            result.put("permissions", new ArrayList<>());
        }
        return result;
    }

    @GetMapping("/getRouters")
    public Map<String, Object> getRouters() {
        return ApiResult.successData(buildRouters());
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResult.success("注册成功");
    }

    @GetMapping("/member/sendEmail")
    public Map<String, Object> sendEmail(@RequestParam("email") String email) {
        if (!StringUtils.hasText(email)) {
            return ApiResult.error("邮箱不能为空");
        }
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
        emailCodeStore.put(email.toLowerCase(Locale.ROOT), new EmailCode(code, Instant.now().plusSeconds(600).toEpochMilli()));
        Map<String, Object> result = ApiResult.success("验证码发送成功");
        result.put("codeValue", code);
        return result;
    }

    @GetMapping("/wxregister/registerByEmail")
    public Map<String, Object> registerByEmail(
        @RequestParam("email") String email,
        @RequestParam("code") String code
    ) {
        if (!isEmailCodeValid(email, code)) {
            return ApiResult.error("验证码错误或已过期");
        }
        return ApiResult.success("校验成功");
    }

    @GetMapping("/wxregister/register")
    public Map<String, Object> wxRegister(@RequestParam Map<String, String> params) {
        String phone = params.get("phoneNum");
        if (!StringUtils.hasText(phone)) {
            return ApiResult.error("手机号不能为空");
        }
        String email = params.get("email");
        if (StringUtils.hasText(email) && !emailExists(email)) {
            // email can be verified via registerByEmail, but we keep this registration path flexible.
        }
        if (phoneExists(phone)) {
            return ApiResult.error("手机号已注册");
        }

        String sql = "INSERT INTO `user` (`name`,`phoneNum`,`password`,`avatar`,`email`,`birthday`,`address`,`money`,`del`) "
            + "VALUES (:name,:phoneNum,:password,:avatar,:email,:birthday,:address,:money,:del)";
        MapSqlParameterSource source = new MapSqlParameterSource();
        source.addValue("name", params.get("name"));
        source.addValue("phoneNum", phone);
        source.addValue("password", params.get("password"));
        source.addValue("avatar", params.get("avatar"));
        source.addValue("email", email);
        source.addValue("birthday", params.get("birthday"));
        source.addValue("address", params.get("address"));
        source.addValue("money", 0);
        source.addValue("del", 0);
        namedJdbcTemplate.update(sql, source);
        return ApiResult.success("注册成功");
    }

    @PostMapping("/loginPhone")
    public Map<String, Object> loginPhone(
        @RequestParam("phoneNumber") String phoneNumber,
        @RequestParam("password") String password
    ) {
        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT * FROM `user` WHERE `phoneNum` = ? AND `password` = ? AND (`del` = 0 OR `del` IS NULL) LIMIT 1",
            phoneNumber,
            password
        );
        if (users.isEmpty()) {
            return ApiResult.error("账号或密码错误");
        }
        Map<String, Object> wxUser = NameUtils.decorateRow(users.get(0));
        String token = tokenService.createWxToken(wxUser);
        Map<String, Object> result = ApiResult.success("登录成功");
        result.put("token", token);
        return result;
    }

    @PostMapping("/loginEmail")
    public Map<String, Object> loginEmail(
        @RequestParam("email") String email,
        @RequestParam("code") String code
    ) {
        if (!isEmailCodeValid(email, code)) {
            return ApiResult.error("验证码错误或已过期");
        }
        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT * FROM `user` WHERE `email` = ? AND (`del` = 0 OR `del` IS NULL) LIMIT 1",
            email
        );
        if (users.isEmpty()) {
            return ApiResult.error("该邮箱未注册");
        }
        Map<String, Object> wxUser = NameUtils.decorateRow(users.get(0));
        String token = tokenService.createWxToken(wxUser);
        Map<String, Object> result = ApiResult.success("登录成功");
        result.put("token", token);
        return result;
    }

    @GetMapping("/getPhoneInfo")
    public Map<String, Object> getPhoneInfo(@RequestHeader(value = "Authorization", required = false) String authorization) {
        Optional<AuthSession> session = tokenService.resolve(authorization);
        if (session.isPresent() && session.get().getWxUser() != null) {
            Map<String, Object> result = ApiResult.success("查询成功");
            result.put("wxuser", session.get().getWxUser());
            return result;
        }

        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT * FROM `user` WHERE (`del` = 0 OR `del` IS NULL) ORDER BY `id` ASC LIMIT 1"
        );
        if (users.isEmpty()) {
            return ApiResult.error("未找到用户信息");
        }
        Map<String, Object> result = ApiResult.success("查询成功");
        result.put("wxuser", NameUtils.decorateRow(users.get(0)));
        return result;
    }

    private boolean isEmailCodeValid(String email, String code) {
        if (!StringUtils.hasText(email) || !StringUtils.hasText(code)) {
            return false;
        }
        EmailCode emailCode = emailCodeStore.get(email.toLowerCase(Locale.ROOT));
        if (emailCode == null) {
            return false;
        }
        if (System.currentTimeMillis() > emailCode.expireAt) {
            emailCodeStore.remove(email.toLowerCase(Locale.ROOT));
            return false;
        }
        return code.trim().equals(emailCode.code);
    }

    private boolean phoneExists(String phone) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM `user` WHERE `phoneNum` = ? AND (`del` = 0 OR `del` IS NULL)",
            Integer.class,
            phone
        );
        return count != null && count > 0;
    }

    private boolean emailExists(String email) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM `user` WHERE `email` = ? AND (`del` = 0 OR `del` IS NULL)",
            Integer.class,
            email
        );
        return count != null && count > 0;
    }

    private String getString(Map<String, Object> body, String key) {
        if (body == null || !body.containsKey(key)) {
            return null;
        }
        Object value = body.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private List<Map<String, Object>> buildRouters() {
        List<Map<String, Object>> routers = new ArrayList<>();
        routers.add(moduleRoute("chargingstation", "充电站管理", "chargingstation",
            child("chongdianzhan", "chargingstation/chongdianzhan/index", "充电站信息"),
            child("opentime", "chargingstation/opentime/index", "开放时间"),
            child("power", "chargingstation/power/index", "功率配置"),
            child("stump", "chargingstation/stump/index", "充电桩"),
            child("stationservice", "chargingstation/stationservice/index", "站点服务"),
            child("stationgrade", "chargingstation/stationgrade/index", "站点评价"),
            child("order", "chargingstation/order/index", "订单管理")
        ));
        routers.add(moduleRoute("member", "会员管理", "user",
            child("userinfo", "member/userinfo/index", "用户信息"),
            child("usercar", "member/usercar/index", "用户车辆"),
            child("bankcard", "member/bankcard/index", "银行卡"),
            child("topup", "member/topup/index", "充值记录"),
            child("outlay", "member/outlay/index", "消费记录")
        ));
        routers.add(moduleRoute("car", "车型管理", "car",
            child("carbrand", "car/carbrand/index", "品牌管理"),
            child("carmodel", "car/carmodel/index", "车型管理"),
            child("carinfo", "car/carinfo/index", "车辆信息")
        ));
        routers.add(moduleRoute("sc", "收藏搜索", "search",
            child("collect", "SC/collect/index", "收藏记录"),
            child("searchrecord", "SC/searchrecord/index", "搜索记录")
        ));
        return routers;
    }

    @SafeVarargs
    private final Map<String, Object> moduleRoute(String path, String title, String icon, Map<String, Object>... children) {
        Map<String, Object> route = new LinkedHashMap<>();
        route.put("name", capitalize(path));
        route.put("path", "/" + path);
        route.put("component", "Layout");
        route.put("alwaysShow", true);
        route.put("meta", meta(title, icon));
        route.put("children", List.of(children));
        return route;
    }

    private Map<String, Object> child(String path, String component, String title) {
        Map<String, Object> child = new LinkedHashMap<>();
        child.put("name", capitalize(path));
        child.put("path", path);
        child.put("component", component);
        child.put("meta", meta(title, "tree"));
        return child;
    }

    private Map<String, Object> meta(String title, String icon) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("title", title);
        meta.put("icon", icon);
        return meta;
    }

    private String capitalize(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private static class EmailCode {
        private final String code;
        private final long expireAt;

        private EmailCode(String code, long expireAt) {
            this.code = code;
            this.expireAt = expireAt;
        }
    }
}
