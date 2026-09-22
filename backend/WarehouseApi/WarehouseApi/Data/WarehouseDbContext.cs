using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using WarehouseApi.Models;

namespace WarehouseApi.Data;

public partial class WarehouseDbContext : DbContext
{
    public WarehouseDbContext(DbContextOptions<WarehouseDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Category> Categories { get; set; }

    public virtual DbSet<Counterparty> Counterparties { get; set; }

    public virtual DbSet<CounterpartyType> CounterpartyTypes { get; set; }

    public virtual DbSet<Document> Documents { get; set; }

    public virtual DbSet<DocumentItem> DocumentItems { get; set; }

    public virtual DbSet<DocumentType> DocumentTypes { get; set; }

    public virtual DbSet<Product> Products { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<Stock> Stocks { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<Warehouse> Warehouses { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("categories_pkey");

            entity.ToTable("categories");

            entity.HasIndex(e => new { e.WarehouseId, e.Id }, "categories_warehouse_id_id_key").IsUnique();

            entity.HasIndex(e => new { e.WarehouseId, e.Name }, "categories_warehouse_id_name_key").IsUnique();

            entity.HasIndex(e => e.WarehouseId, "idx_categories_warehouse");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.WarehouseId).HasColumnName("warehouse_id");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Categories)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("categories_warehouse_id_fkey");
        });

        modelBuilder.Entity<Counterparty>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("counterparties_pkey");

            entity.ToTable("counterparties");

            entity.HasIndex(e => new { e.WarehouseId, e.Id }, "counterparties_warehouse_id_id_key").IsUnique();

            entity.HasIndex(e => e.WarehouseId, "idx_counterparties_warehouse");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Phone).HasColumnName("phone");
            entity.Property(e => e.TypeId).HasColumnName("type_id");
            entity.Property(e => e.WarehouseId).HasColumnName("warehouse_id");

            entity.HasOne(d => d.Type).WithMany(p => p.Counterparties)
                .HasForeignKey(d => d.TypeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("counterparties_type_id_fkey");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Counterparties)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("counterparties_warehouse_id_fkey");
        });

        modelBuilder.Entity<CounterpartyType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("counterparty_types_pkey");

            entity.ToTable("counterparty_types");

            entity.HasIndex(e => e.Name, "counterparty_types_name_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
        });

        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("documents_pkey");

            entity.ToTable("documents");

            entity.HasIndex(e => e.Number, "documents_number_key").IsUnique();

            entity.HasIndex(e => e.CounterpartyId, "idx_documents_counterparty");

            entity.HasIndex(e => e.TypeId, "idx_documents_type");

            entity.HasIndex(e => e.UserId, "idx_documents_user");

            entity.HasIndex(e => e.WarehouseId, "idx_documents_warehouse");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Comment).HasColumnName("comment");
            entity.Property(e => e.CounterpartyId).HasColumnName("counterparty_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Number).HasColumnName("number");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'Черновик'::text")
                .HasColumnName("status");
            entity.Property(e => e.TargetWarehouseId).HasColumnName("target_warehouse_id");
            entity.Property(e => e.TypeId).HasColumnName("type_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.WarehouseId).HasColumnName("warehouse_id");

            entity.HasOne(d => d.TargetWarehouse).WithMany(p => p.DocumentTargetWarehouses)
                .HasForeignKey(d => d.TargetWarehouseId)
                .HasConstraintName("documents_target_warehouse_id_fkey");

            entity.HasOne(d => d.Type).WithMany(p => p.Documents)
                .HasForeignKey(d => d.TypeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("documents_type_id_fkey");

            entity.HasOne(d => d.User).WithMany(p => p.Documents)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("documents_user_id_fkey");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.DocumentWarehouses)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("documents_warehouse_id_fkey");

            entity.HasOne(d => d.Counterparty).WithMany(p => p.Documents)
                .HasPrincipalKey(p => new { p.WarehouseId, p.Id })
                .HasForeignKey(d => new { d.WarehouseId, d.CounterpartyId })
                .HasConstraintName("documents_warehouse_id_counterparty_id_fkey");
        });

        modelBuilder.Entity<DocumentItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("document_items_pkey");

            entity.ToTable("document_items");

            entity.HasIndex(e => e.DocumentId, "idx_document_items_doc");

            entity.HasIndex(e => e.ProductId, "idx_document_items_product");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DocumentId).HasColumnName("document_id");
            entity.Property(e => e.Price)
                .HasPrecision(12, 2)
                .HasColumnName("price");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.Quantity)
                .HasPrecision(14, 3)
                .HasColumnName("quantity");

            entity.HasOne(d => d.Document).WithMany(p => p.DocumentItems)
                .HasForeignKey(d => d.DocumentId)
                .HasConstraintName("document_items_document_id_fkey");

            entity.HasOne(d => d.Product).WithMany(p => p.DocumentItems)
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("document_items_product_id_fkey");
        });

        modelBuilder.Entity<DocumentType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("document_types_pkey");

            entity.ToTable("document_types");

            entity.HasIndex(e => e.Name, "document_types_name_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("products_pkey");

            entity.ToTable("products");

            entity.HasIndex(e => e.CategoryId, "idx_products_category");

            entity.HasIndex(e => e.WarehouseId, "idx_products_warehouse");

            entity.HasIndex(e => new { e.WarehouseId, e.Id }, "products_warehouse_id_id_key").IsUnique();

            entity.HasIndex(e => new { e.WarehouseId, e.Sku }, "products_warehouse_id_sku_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Barcode).HasColumnName("barcode");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.MinStockLevel)
                .HasPrecision(14, 3)
                .HasColumnName("min_stock_level");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Price)
                .HasPrecision(12, 2)
                .HasColumnName("price");
            entity.Property(e => e.Sku).HasColumnName("sku");
            entity.Property(e => e.Unit)
                .HasDefaultValueSql("'шт'::text")
                .HasColumnName("unit");
            entity.Property(e => e.WarehouseId).HasColumnName("warehouse_id");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Products)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("products_warehouse_id_fkey");

            entity.HasOne(d => d.Category).WithMany(p => p.Products)
                .HasPrincipalKey(p => new { p.WarehouseId, p.Id })
                .HasForeignKey(d => new { d.WarehouseId, d.CategoryId })
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("products_warehouse_id_category_id_fkey");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("roles_pkey");

            entity.ToTable("roles");

            entity.HasIndex(e => e.Name, "roles_name_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
        });

        modelBuilder.Entity<Stock>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("stock_pkey");

            entity.ToTable("stock");

            entity.HasIndex(e => e.ProductId, "idx_stock_product");

            entity.HasIndex(e => e.WarehouseId, "idx_stock_warehouse");

            entity.HasIndex(e => new { e.ProductId, e.WarehouseId }, "stock_product_id_warehouse_id_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.Quantity)
                .HasPrecision(14, 3)
                .HasColumnName("quantity");
            entity.Property(e => e.WarehouseId).HasColumnName("warehouse_id");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Stocks)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stock_warehouse_id_fkey");

            entity.HasOne(d => d.Product).WithMany(p => p.Stocks)
                .HasPrincipalKey(p => new { p.WarehouseId, p.Id })
                .HasForeignKey(d => new { d.WarehouseId, d.ProductId })
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stock_warehouse_id_product_id_fkey");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("users_pkey");

            entity.ToTable("users");

            entity.HasIndex(e => e.WarehouseId, "idx_users_warehouse");

            entity.HasIndex(e => e.Username, "users_username_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.FullName).HasColumnName("full_name");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.Username).HasColumnName("username");
            entity.Property(e => e.WarehouseId).HasColumnName("warehouse_id");

            entity.HasOne(d => d.Role).WithMany(p => p.Users)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("users_role_id_fkey");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Users)
                .HasForeignKey(d => d.WarehouseId)
                .HasConstraintName("users_warehouse_id_fkey");
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("warehouses_pkey");

            entity.ToTable("warehouses");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.Name).HasColumnName("name");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
