package com.example.audit;

import com.example.entity.BaseEntity;

public class AuditEntity extends BaseEntity<Long> {
    private String updatedBy;
    private String shadowedField;

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
