# Parameter Validation Guide

## Overview

MyBatis Boost now provides real-time validation and navigation for SQL parameter references in XML mapper files. This feature helps catch parameter errors during development, before they cause runtime issues.

## Features

### 1. Real-time Parameter Validation

The extension validates all `#{paramName}` and `${paramName}` references in your XML mapper files against:

- **parameterType classes**: Validates against Java class fields
- **@Param annotations**: Validates against method parameter names
- **Nested properties**: Supports validation of root properties (e.g., `#{user.name}` validates `user`)

### 2. Jump-to-Definition (F12)

Navigate directly from XML parameters to their Java definitions:

- Click on `#{paramName}` → Jump to Java field definition
- Click on `#{paramName}` → Jump to `@Param("paramName")` annotation

## Examples

### Example 1: parameterType Validation

**Java Entity:**
```java
public class Role {
    private Long id;
    private String roleName;
    private String remark;
    private Integer version;
}
```

**XML Mapper:**
```xml
<update id="updateById" parameterType="com.example.Role">
    UPDATE role
    SET role_name = #{roleName},    <!-- ✅ Valid -->
        remark = #{remark},          <!-- ✅ Valid -->
        invalid = #{invalidField}    <!-- ❌ Error: Field doesn't exist -->
    WHERE id = #{id}                 <!-- ✅ Valid -->
</update>
```

### Example 2: @Param Annotation Validation

**Java Interface:**
```java
@Mapper
public interface RoleMapper {
    List<Role> selectByCriteria(
        @Param("roleName") String name,
        @Param("remark") String remark
    );
}
```

**XML Mapper:**
```xml
<select id="selectByCriteria" resultType="Role">
    SELECT * FROM role
    WHERE role_name = #{roleName}   <!-- ✅ Valid: @Param annotation exists -->
      AND remark = #{remark}        <!-- ✅ Valid: @Param annotation exists -->
      AND status = #{status}        <!-- ❌ Error: No @Param for 'status' -->
</select>
```

### Example 3: Mixed Parameters

**Java Interface:**
```java
@Mapper
public interface RoleMapper {
    int deleteByIdAndVersion(
        @Param("id") Long id,
        @Param("version") Integer version
    );
}
```

**XML Mapper:**
```xml
<delete id="deleteByIdAndVersion">
    DELETE FROM role
    WHERE id = #{id}              <!-- ✅ Valid: @Param exists -->
      AND version = #{version}    <!-- ✅ Valid: @Param exists -->
</delete>
```

### Example 4: Nested Properties

**Java Entities:**
```java
public class User {
    private Long id;
    private Address address;  // Nested object
}

public class Address {
    private String city;
    private String street;
}
```

**XML Mapper:**
```xml
<insert id="insert" parameterType="User">
    INSERT INTO users (id, city, street)
    VALUES (
        #{id},            <!-- ✅ Valid: User has 'id' field -->
        #{address.city},  <!-- ✅ Valid: User has 'address' root property -->
        #{address.street} <!-- ✅ Valid: User has 'address' root property -->
    )
</insert>
```

**Note**: Currently, only the root property is validated (e.g., `address` in `#{address.city}`). Full nested property validation may be added in future versions.

## Error Messages

When a parameter is invalid, you'll see:

```
Parameter 'invalidField' is not defined. Expected one of: id, roleName, remark, version
```

The error includes:
- The invalid parameter name
- A list of all valid parameters for that statement

## Usage Tips

1. **Immediate Feedback**: Errors appear as you type, with red underlines
2. **Navigate to Fix**: Use F12 on valid parameters to jump to their definitions
3. **Check Multiple Files**: Validation works across all open XML mapper files
4. **Bulk Validation**: Open all XML files to validate your entire project

## Supported Statement Types

Parameter validation works in:
- `<select>`
- `<insert>`
- `<update>`
- `<delete>`

## Limitations

Current limitations (may be addressed in future versions):

1. **Nested Property Validation**: Only root properties are validated
   - `#{user.name}` validates `user` exists, but not `name`
2. **parameterMap**: Not yet supported (use `parameterType` or `@Param` instead)
3. **Dynamic SQL**: Parameters inside `<if>`, `<where>`, etc. are validated the same way

## Configuration

Parameter validation is enabled by default. No additional configuration is required.

## Troubleshooting

**Q: Why is a valid parameter showing as an error?**
- Ensure the Java class is in your workspace
- Check that the `parameterType` attribute uses the fully-qualified class name
- Verify the `@Param` annotation spelling matches exactly

**Q: Can I disable parameter validation?**
- Currently, validation is always enabled for MyBatis mapper files
- Future versions may add a configuration option

**Q: Validation is slow in large projects**
- Parameter validation is optimized and should be fast
- If you experience issues, please report them on GitHub

## Related Features

- [Navigation Guide](../README.md#-10-types-of-go-to-definition-navigation)
- [Configuration Options](../README.md#configuration)
